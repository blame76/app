import pain from './pain/index.js';
import discount from './discount/index.js';
import drink from './drink/index.js';
import parking from './parking/index.js';
import warteAuf from './warte-auf/index.js';
import training from './training/index.js';

// Add each helper once; the shell and offline cache use this static list.
export const HELPERS = [pain, discount, drink, parking, warteAuf, training];
