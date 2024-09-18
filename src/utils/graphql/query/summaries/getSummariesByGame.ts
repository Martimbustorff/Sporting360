import { gql } from "@apollo/client";

export const GET_SUMMARIES_BY_ID = gql`
query getSummart($filters: SummaryFiltersInput) {
  summaries(filters: $filters, pagination: { limit: 100 }) {
    data {
      id,
      attributes {
        Detail,
        Comments,
        Team{
          data{
            id
          }
        }
        Game{
          data{
            id
          }
        }
        PlayerSub{
          data{
            attributes{
              Name
            }
          }
        }
        Type,
        Time,
        TimeExtra,
        player{
          data{
            attributes{
              Name
            }
          }
        }
      }
    }
  }
}
`;
