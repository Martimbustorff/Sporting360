import { gql } from "@apollo/client";

export const GET_STATISTICS_BY_ID = gql`
query getSummart($filters: StatisticFiltersInput) {
  statistics(filters: $filters, pagination: { limit: 100 }) {
    data {
      id,
      attributes{
        game{
          data{id}
        }
        Team{
          data{id}
        }
        Type,
        Value
      }
    }
  }
}
`;
