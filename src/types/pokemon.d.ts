export interface MCPPokemonGetInput {
  name: string;
}

export interface MCPPokemonGetOutput {
  name: string;
  height: number;
  weight: number;
  types: string[];
  moves: string[];
  sprite?: string;
}

export interface MCPPokemonSoundInput {
  name: string;
}

export interface MCPPokemonSoundOutput {
  name: string;
  url: string;
}
