import { etc } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { concatBytes } from '@noble/hashes/utils';

etc.sha512Sync = (...messages) => sha512(concatBytes(...messages));
etc.sha512Async = (...messages) => Promise.resolve(sha512(concatBytes(...messages)));
