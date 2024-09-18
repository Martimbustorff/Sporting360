import { gql } from "@apollo/client";

export const GET_GAMES = gql`
query getgames{
  games( pagination: { limit: 100 }) {
    data{
      id,
      attributes{
        Competation,
        API,
        ElapseTime,
        Timestamp,
        Channel,
        Journey,
        ScoreHome,
        ScoreAway,
        TeamHome{
          data{
            attributes{
              Name,
              Logo
            }
          }
        }
        TeamAway{
          data{
            attributes{
              Name,
              Logo
            }
          }
        }
      }
    }
  }
}
`;