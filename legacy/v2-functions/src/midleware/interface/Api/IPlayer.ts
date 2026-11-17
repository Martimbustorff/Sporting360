export interface PlayerResponse {
    get: string
    parameters: {
        fixture: string;
    };
    errors: any[]
    results: number
    paging: {
        current: number;
        total: number;
    };
    response: Response[]
}
// Define the structure of the API response using TypeScript interfaces

interface Response {
    team: Team;
    players: Player[];
}

interface Team {
    id: string;
    name: string;
    logo: string;
    update: string; // ISO date string
}

interface Player {
    player: PlayerDetails;
    statistics: Statistics[];
}

interface PlayerDetails {
    id: number;
    name: string;
    photo: string;
}


interface Statistics {
    games: Games;
    offsides: number ;
    shots: Shots ;
    goals: Goals ;
    passes: Passes ;
    tackles: Tackles ;
    duels: Duels ;
    dribbles: Dribbles ;
    fouls: Fouls ;
    cards: Cards ;
    penalty: Penalty ;
}

interface Games{
    minutes: number;
    number: number;
    position: string;
    rating: string;
    captain: boolean;
    substitute: boolean;
}

interface Shots {
    total: number;
    on: number;
}

interface Goals {
    total: number ;
    conceded: number;
    assists: number ;
    saves: number;
}

interface Passes {
    total: number;
    key: number;
    accuracy: string;
}

interface Tackles {
    total: number ;
    blocks: number;
    interceptions: number;
}

interface Duels {
    total: number;
    won: number;
}

interface Dribbles {
    attempts: number;
    success: number;
    past: number ;
}

interface Fouls {
    drawn: number;
    committed: number;
}

interface Cards {
    yellow: number;
    red: number;
}

interface Penalty {
    won: number ;
    commited: number ;
    scored: number;
    missed: number;
    saved: number;
}
