window.DERBY_REWARDS_CONFIG = {
  // Public student storefront. Keep only rewards that should appear to students.
  rewards: [
    { id: "choose-seat", name: "Choose Your Seat Pass", description: "Pick your seat for one class.", price: 12, icon: "▣", active: true },
    { id: "music-request", name: "Music Request Pass", description: "Choose a clean work-time song.", price: 15, icon: "♫", active: true },
    { id: "sit-with-friend", name: "Sit With a Friend Pass", description: "Choose a classroom partner.", price: 18, icon: "♟", active: true },
    { id: "classroom-vip", name: "Classroom VIP Pass", description: "Be the teacher helper for a class.", price: 20, icon: "★", active: true },
    { id: "activity-pass", name: "Activity Pass", description: "Choose a five-minute class activity.", price: 22, icon: "⚡", active: true },
    { id: "teacher-choice", name: "Teacher Choice Pass", description: "A special classroom privilege.", price: 25, icon: "✦", active: true },
    { id: "announcement-guest", name: "Morning Announcement Guest", description: "Share a positive message on announcements.", price: 28, icon: "◉", active: true },
    { id: "class-experience", name: "Class Experience Pass", description: "Help choose a future class experience.", price: 30, icon: "☀", active: true }
  ],

  // Dedicated Character Cash Google Form goes here.
  // The site will prefill Name, Grade, Reward, and Cost once these values are filled.
  googleFormUrl: "",
  googleFormFields: {
    name: "",
    grade: "",
    reward: "",
    cost: ""
  }
};