export interface LineupResponse {
  get: string
  parameters: Parameters
  errors: any[]
  results: number
  paging: Paging
  response: Response[]
}

export interface Parameters {
  fixture: string
}

export interface Paging {
  current: number
  total: number
}

export interface Response {
  team: Team
  formation: string
  startXI: StartXi[]
  substitutes: Substitute[]
  coach: Coach
}

export interface Team {
  id: number
  name: string
  logo: string
  colors: Colors
}

export interface Colors {
  player: Player
  goalkeeper: Goalkeeper
}

export interface Player {
  primary: string
  number: string
  border: string
}

export interface Goalkeeper {
  primary: string
  number: string
  border: string
}

export interface StartXi {
  player: Player2
}

export interface Player2 {
  id: number
  name: string
  number: number
  pos: string
  grid: string
}

export interface Substitute {
  player: Player3
}

export interface Player3 {
  id: number
  name: string
  number: number
  pos: string
  grid: any
}

export interface Coach {
  id: number
  name: string
  photo: string
}
