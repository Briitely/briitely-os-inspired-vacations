export const inspiredVacationsOpportunityFields = {
  inquiryDestination: "rI8N2cF9j3xKQD7avW1o",
  travelTimeframe: "qY4M7bV2n6pLZC8wXf0r",
  numberOfAdults: "tG5P9dE3s7aHBJ6mKn1",
  numberOfChildren: "uH6Q1eR4f8bIcL7oPj2",
  childrenAges: "vI7R2fS5g9cJdM8pQk3",
  travelBudget: "wJ8S3gT6h0dKeN9qRl4",
  travelInsuranceInterest: "xK9T4hU7i1eLfO0rSm5",
  specialConsiderations: "yL0U5iV8j2fMgP1sTn6",
  confirmedTripType: "zM1V6jW9k3gNhQ2tUo7",
  confirmedDestination: "aN2W7kX0l4hOiR3uVp8",
  departureDate: "bO3X8lY1m5iPjS4vWq9",
  returnDate: "cP4Y9mZ2n6jQkT5wXr0",
} as const;

export type OpportunityFieldKey = keyof typeof inspiredVacationsOpportunityFields;

export const requiredIntakeFieldKeys: OpportunityFieldKey[] = [
  "inquiryDestination",
  "travelTimeframe",
  "numberOfAdults",
  "numberOfChildren",
  "childrenAges",
  "travelBudget",
  "travelInsuranceInterest",
  "specialConsiderations",
];
