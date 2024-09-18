import { gql } from "@apollo/client";

export const GET_GAME_BY_ID = gql`
query getgames($gameId: ID!) {
  game(id: $gameId) {
    data {
      id,
      attributes {
        Competation,
        API,
        ElapseTime,
        Timestamp,
        Channel,
        Journey,
        ScoreHome,
        ScoreAway,
        TeamHome {
          data {
            id,
            attributes {
              Name,
              Logo
            }
          }
        }
        TeamAway {
          data {
            attributes {
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
