// ML Intelligence Layer mock data

// Resolution intelligence messages
export const resolutionInsights: Record<string, { icon: string; message: string }> = {
  fix: {
    icon: "insight",
    message: "Apex Roofing LLC has had 2 ACH returns in 90 days. Pulse will monitor this vendor's bank account health going forward.",
  },
  rotate: {
    icon: "insight",
    message: "Your token rotation completed 12 days before expiry. Pulse will remind you 30 days before the new token expires.",
  },
  endpoint: {
    icon: "insight",
    message: "Your endpoint was unreachable for 47 minutes. Pulse detected the failure after 3 delivery attempts and notified you within 2 minutes.",
  },
  view: {
    icon: "insight",
    message: "Pulse will continue monitoring this merchant's activity and alert you if the pattern recurs.",
  },
};
