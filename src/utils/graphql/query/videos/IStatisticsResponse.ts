
interface VideosAttributes {
  URL: string;
  Description: string; // Adjust the type based on the possible values
}

interface VideosData {
  id: string;
  attributes: VideosAttributes;
}

interface Videos {
  data: VideosData[];
}

export interface IVideosResponse {
  videos: Videos;
}


