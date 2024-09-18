export interface IFixture {
  fixtureCollection: FixtureCollection
}

export interface FixtureCollection {
  edges: Edge[],
  pageInfo: {
    endCursor: string,
    hasNextPage: boolean
  }
}

export interface Edge {
  node: Node
}

export interface Node {
  id: string
  channel: string
  journey: string
  teamAway: string
  teamHome: string
  scoreaway: string
  scorehome: string
  timestamp: string
  competation: string
}
