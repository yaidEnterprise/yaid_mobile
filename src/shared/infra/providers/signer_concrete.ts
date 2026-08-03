import './_setup_ed25519';
import { getPublicKey, signAsync } from '@noble/ed25519';
import { ISigner } from '../../domain/interfaces/providers/signer';


// TODO: 1) O que é "Concrete" ? Deve ser colocado o nome da ferramenta externa que foi utilizado. Ex.: Implementação concreta do IUserRepository foi feita com postgresql, entao fica UserRepositoryPgSQL implements IUserRepository. 2) Overengineering de ports/adapters: a arquitetura é muito boa, mas essa classe é o exemplo do que não fazer -> qual exatamente é o ganho de criar um port/adapter e mockar isso ? Não existe critério nenhum, ambas as implementações são identicas. O que criar implementação concreta ? 

// Não crie uma port/interface apenas para encapsular funções puras, determinísticas e locais de uma biblioteca. Use uma utility ou módulo interno quando o wrapper apenas repassar parâmetros e retornos. Crie uma port quando houver uma fronteira externa, comportamento ambiental, estratégia substituível ou necessidade de controle do comportamento pelo caso de uso.

// Um adapter deve converter entre o modelo da aplicação e uma tecnologia externa. Se a implementação concreta e o mock importam e executam a mesma biblioteca, o mock não é um test double e a abstração provavelmente não está produzindo isolamento.
export class SignerConcrete implements ISigner {
  getPublicKey(seed: Uint8Array): Uint8Array {
    return getPublicKey(seed);
  }

  async sign(payload: Uint8Array, seed: Uint8Array): Promise<Uint8Array> {
    return signAsync(payload, seed);
  }
}
