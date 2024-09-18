interface Player {
  data: {
    attributes: {
      Name: string;
    };
  };
}

interface Team {
  data: {
    id: string;
  };
}

export interface Summary {
  id: string;
  attributes: {
    Detail: string;
    Comments: string | null;
    Team: Team;
    Game: Team;
    PlayerSub: {
      data: Player | null;
    };
    Type: string;
    Time: string;
    TimeExtra: string | null;
    player: Player;
  };
}


 export interface ISummariesResponse {
  summaries: {
    data: Summary[];
  };
}

