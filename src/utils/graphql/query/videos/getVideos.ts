import { gql } from "@apollo/client";

export const GET_VIDEOS_BY_GAME = gql`
query getVideos($filters: VideoFiltersInput) {
  videos(filters: $filters, pagination: { limit: 100 }) {
    data {
      attributes {
        URL,
        Description
      }
    }
  }
}
`;
