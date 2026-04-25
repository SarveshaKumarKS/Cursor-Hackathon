// Default task suggestions per project kind. Used by ProjectWizard.

export const PROJECT_KINDS = [
  { id: "cleaning", label: "Apartment cleanup", emoji: "🧹" },
  { id: "coding", label: "Coding sprint", emoji: "💻" },
  { id: "gym", label: "Gym session", emoji: "🏋️" },
  { id: "custom", label: "Custom", emoji: "✨" },
];

export const TASK_TEMPLATES = {
  cleaning: [
    "Vacuum living room",
    "Kitchen counters + dishes",
    "Bathroom deep clean",
    "Trash + recycling",
    "Laundry load",
  ],
  coding: [
    "Define data model",
    "Build API endpoint",
    "Frontend layout + state",
    "Tests + edge cases",
    "Deploy + smoke test",
  ],
  gym: [
    "Warm-up + mobility",
    "Strength: upper",
    "Strength: lower",
    "Cardio finisher",
    "Cool-down + stretch",
  ],
  custom: [],
};

export function templateFor(kind) {
  return TASK_TEMPLATES[kind] ?? [];
}
