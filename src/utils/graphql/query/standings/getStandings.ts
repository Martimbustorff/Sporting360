import { gql } from "@apollo/client";

export const GET_STANDINGS = gql`
query Standings($sort: [String],$filters: StandingFiltersInput) {
  standings(sort: $sort, filters: $filters,pagination: { limit: 100 }) {
    data {
      attributes {
        Competation,
        Draw,
        GoalsAgainst,
        GoalsFor,
        Lose,
        Played,
        Points,
        Rank,
        Win,
        Team {
          data {
            attributes {
              Name
            }
          }
        }
      }
    }
  }
}
`;
