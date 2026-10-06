window.DERBY_REWARDS_CONFIG = {
  // Mirrors the current locally saved Derby Character Points reward catalog.
  rewards: [
    { id: "sit-with-friend", name: "Sit With a Friend Pass", description: "Choose a classroom partner.", price: 18, icon: "♟", active: true },
    { id: "stand-door-keeper", name: "Stand Door Keeper Pass", description: "Take care of the stands and the door.", price: 20, icon: "★", active: true },
    { id: "practice-room-b-solo", name: "Practice Room B", description: "Practice in Practice Room B by yourself.", price: 40, icon: "♫", active: true },
    { id: "practice-room-b-friend", name: "Practice Room B", description: "Practice with one friend. You must practice.", price: 80, icon: "↔", active: true }
  ],

  googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfd9zYYmNVdJ7NrYSDiannupS_P2-kW0-87OY4yX3p-CfEJCA/viewform",
  googleFormFields: {
    name: "entry.1562034853",
    grade: "entry.1930865252",
    reward: "entry.480710405",
    cost: "entry.252775878"
  },

  // Optional teacher-only dashboard notification feed.
  // Point this at a count-only JSON/CSV/text endpoint (for example a published
  // Google Sheet tab containing only the total number of reward submissions).
  // No student names need to be published for the rehearsal-board badge.
  requestFeedUrl: "https://jasonatkinson123-sketch.github.io/band-tools-dashboard/reward-requests.json",
  requestManageUrl: "https://jasonatkinson123-sketch.github.io/derby-character-cash/?view=rewards"
};
