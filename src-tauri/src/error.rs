use thiserror::Error;

#[derive(Debug, Error)]
pub enum CadenzaError {
    #[error("bpm must be positive")]
    InvalidBpm,
    #[error("unsupported payload type: {0}")]
    UnsupportedType(String),
    #[error("{0}")]
    Message(String),
}
