export type AppScreen = "home" | "load" | "player";

export function continueTarget(hasScore: boolean): AppScreen {
  return hasScore ? "player" : "load";
}

export function shouldAutoNavigateToPlayer(
  hasScore: boolean,
  screen: AppScreen,
): boolean {
  return hasScore && (screen === "load" || screen === "home");
}
