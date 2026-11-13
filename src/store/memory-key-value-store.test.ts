import { describeKeyValueStore } from './key-value-store.contract.js';
import { MemoryKeyValueStore } from './memory-key-value-store.js';

describeKeyValueStore('In-memory', () => new MemoryKeyValueStore());
