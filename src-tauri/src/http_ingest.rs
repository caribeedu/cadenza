use axum::{
    extract::State,
    http::{Method, StatusCode},
    routing::post,
    Json, Router,
};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::app_state::SharedAppState;
use crate::error::CadenzaError;
use crate::protocol::{ErrorBody, ScoreAck, ScorePayload};

pub fn spawn_http_server(state: SharedAppState) {
    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async {
            if let Err(error) = run_server(state).await {
                tracing::error!("HTTP ingest server stopped: {error}");
            }
        });
    });
}

async fn run_server(state: SharedAppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        .route("/score", post(post_score))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8765").await?;
    info!("Cadenza HTTP ingest listening on http://127.0.0.1:8765/score");
    crate::file_log::write_event("http_server_started", "port=8765");
    axum::serve(listener, app).await?;
    Ok(())
}

/// Maps score ingest failures to HTTP status, `app_error` code, and user message.
pub(crate) fn score_error_parts(error: &CadenzaError) -> (StatusCode, &'static str, String) {
    match error {
        CadenzaError::InvalidBpm => (
            StatusCode::BAD_REQUEST,
            "invalid_bpm",
            "bpm must be positive".to_string(),
        ),
        CadenzaError::UnsupportedType(value) => (
            StatusCode::BAD_REQUEST,
            "unsupported_type",
            format!("unsupported payload type: {value}"),
        ),
        CadenzaError::Message(message) => (
            StatusCode::BAD_REQUEST,
            "invalid_score_payload",
            message.clone(),
        ),
    }
}

fn map_score_error(state: &SharedAppState, error: CadenzaError) -> (StatusCode, Json<ErrorBody>) {
    let (status, code, message) = score_error_parts(&error);
    state.emit_app_error(code, &message, true);
    (status, Json(ErrorBody { error: message }))
}

async fn post_score(
    State(state): State<SharedAppState>,
    Json(payload): Json<ScorePayload>,
) -> Result<Json<ScoreAck>, (StatusCode, Json<ErrorBody>)> {
    match state.apply_score(payload) {
        Ok(ack) => Ok(Json(ack)),
        Err(error) => Err(map_score_error(&state, error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::CadenzaError;
    use crate::protocol::AppErrorEvent;
    use std::fs;

    fn load_fixture(name: &str) -> String {
        let path = format!("{}/../fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
        fs::read_to_string(&path).unwrap_or_else(|_| panic!("read {path}"))
    }

    #[test]
    fn invalid_bpm_fixture_maps_to_http_and_app_error_shape() {
        let raw = load_fixture("invalid_bpm.json");
        let payload: ScorePayload = serde_json::from_str(&raw).expect("json");
        let timeline_err = crate::timeline::build_timeline(payload).expect_err("invalid bpm");
        assert!(matches!(timeline_err, CadenzaError::InvalidBpm));

        let (status, code, message) = score_error_parts(&timeline_err);
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(code, "invalid_bpm");
        assert_eq!(message, "bpm must be positive");

        let event = AppErrorEvent {
            code: code.into(),
            message: message.clone(),
            recoverable: true,
        };
        let json = serde_json::to_value(&event).expect("serialize");
        assert_eq!(json["code"], "invalid_bpm");
        assert_eq!(json["message"], "bpm must be positive");
        assert_eq!(json["recoverable"], true);

        let body = ErrorBody { error: message };
        assert_eq!(body.error, "bpm must be positive");
    }

    #[test]
    fn unsupported_type_maps_to_app_error_code() {
        let err = CadenzaError::UnsupportedType("midi".into());
        let (status, code, message) = score_error_parts(&err);
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(code, "unsupported_type");
        assert!(message.contains("midi"));
    }
}
