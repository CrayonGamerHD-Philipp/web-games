/**
 * @typedef {{ id: string, name: string }} BasicPlayer
 * @typedef {'lime' | 'yellow' | 'blue' | 'pink' | 'peach'} NochMalColor
 * @typedef {NochMalColor | 'joker'} NochMalColorDie
 * @typedef {1 | 2 | 3 | 4 | 5 | 'joker'} NochMalNumberDie
 * @typedef {{ columnPoints: number, colorPoints: number, starPenalty: number, jokerPenalty: number, total: number }} NochMalScoreBreakdown
 * @typedef {{ first: string[], normal: string[] }} NochMalBonusClaim
 * @typedef {{ id: string, name: string, checkedCells: string[], usedJokers: number, selectedColor: NochMalColor | null, selectedNumber: number | null, selectedColorDieIndex: number | null, selectedNumberDieIndex: number | null, pendingCells: string[], confirmed: boolean, skipped: boolean, score: NochMalScoreBreakdown }} NochMalPlayer
 * @typedef {{ id: string, colorDice: NochMalColorDie[], numberDice: NochMalNumberDie[] }} NochMalDiceRoll
 * @typedef {{ phase: 'selecting-dice' | 'selecting-cells' | 'waiting' | 'finished', round: number, roll: NochMalDiceRoll, confirmedPlayerIds: string[], activePlayerId: string | null, activeColorDieIndex: number | null, activeNumberDieIndex: number | null, colorBonusClaims: Record<NochMalColor, NochMalBonusClaim>, columnBonusClaims: NochMalBonusClaim[], winnerIds: string[], winnerId: string | null, isDraw: boolean, roundScores: { playerId: string, score: number, breakdown: NochMalScoreBreakdown }[] }} NochMalState
 * @typedef {{ id: string, gameId: 'noch-mal', name: string, status: 'running' | 'finished', createdAt: string, players: NochMalPlayer[], state: NochMalState }} NochMalSession
 * @typedef {{ type?: unknown, cellId?: unknown, colorDieIndex?: unknown, numberDieIndex?: unknown, color?: unknown, number?: unknown }} NochMalMove
 */

export const nochMalGame = {
  id: 'noch-mal',
  name: 'Noch mal',
  description: 'Wuerfelspiel mit privaten Spielblaettern, gemeinsamen Wuerfeln und gleichzeitigen Zuegen.',
  minPlayers: 1,
  maxPlayers: 6
};

/** @type {NochMalColor[]} */
const colors = ['lime', 'yellow', 'blue', 'pink', 'peach'];
const rows = [
  ['lime', 'lime', 'lime', 'yellow', 'yellow', 'yellow', 'yellow', 'lime', 'blue', 'blue', 'blue', 'peach', 'yellow', 'yellow', 'yellow'],
  ['peach', 'lime', 'yellow', 'lime', 'yellow', 'yellow', 'peach', 'peach', 'pink', 'blue', 'blue', 'peach', 'peach', 'lime', 'lime'],
  ['blue', 'lime', 'pink', 'lime', 'lime', 'lime', 'lime', 'pink', 'pink', 'pink', 'yellow', 'yellow', 'peach', 'lime', 'lime'],
  ['blue', 'pink', 'pink', 'lime', 'peach', 'peach', 'blue', 'blue', 'lime', 'lime', 'yellow', 'yellow', 'peach', 'pink', 'blue'],
  ['pink', 'peach', 'peach', 'peach', 'peach', 'pink', 'blue', 'blue', 'peach', 'peach', 'peach', 'pink', 'pink', 'pink', 'pink'],
  ['pink', 'blue', 'blue', 'pink', 'pink', 'pink', 'pink', 'yellow', 'yellow', 'peach', 'pink', 'blue', 'blue', 'blue', 'peach'],
  ['yellow', 'yellow', 'blue', 'blue', 'blue', 'blue', 'pink', 'yellow', 'yellow', 'yellow', 'lime', 'lime', 'lime', 'peach', 'peach']
];
const stars = new Set(['0-7', '1-2', '1-4', '1-9', '2-0', '2-6', '3-5', '3-13', '5-1', '5-3', '5-8', '5-10', '5-14', '6-12']);
const topScore = [5, 3, 3, 3, 2, 2, 2, 1, 2, 2, 2, 3, 3, 3, 5];
const bottomScore = [3, 2, 2, 2, 1, 1, 1, 0, 1, 1, 1, 2, 2, 2, 3];

/** @type {Record<string, { id: string, row: number, column: number, color: NochMalColor, hasStar: boolean }>} */
const cellMap = Object.fromEntries(rows.flatMap((row, rowIndex) => row.map((color, columnIndex) => {
  const id = `${rowIndex}-${columnIndex}`;
  return [id, { id, row: rowIndex, column: columnIndex, color: /** @type {NochMalColor} */ (color), hasStar: stars.has(id) }];
})));

/** @returns {NochMalScoreBreakdown} */
function emptyScore() {
  return { columnPoints: 0, colorPoints: 0, starPenalty: 0, jokerPenalty: 8, total: 8 };
}

/** @returns {NochMalBonusClaim} */
function emptyBonusClaim() {
  return { first: [], normal: [] };
}

/** @param {unknown} value @returns {NochMalBonusClaim} */
function normalizeBonusClaim(value) {
  const candidate = /** @type {{ first?: unknown, normal?: unknown } | null} */ (value && typeof value === 'object' ? value : null);
  if (candidate && Array.isArray(candidate.first) && Array.isArray(candidate.normal)) {
    return /** @type {NochMalBonusClaim} */ (candidate);
  }
  if (Array.isArray(value)) {
    const [first, ...normal] = value.filter((id) => typeof id === 'string');
    return { first: first ? [first] : [], normal };
  }
  return emptyBonusClaim();
}

/** @returns {NochMalDiceRoll} */
function rollDice() {
  const colorFaces = /** @type {NochMalColorDie[]} */ ([...colors, 'joker']);
  const numberFaces = /** @type {NochMalNumberDie[]} */ ([1, 2, 3, 4, 5, 'joker']);
  return {
    id: crypto.randomUUID(),
    colorDice: Array.from({ length: 3 }, () => colorFaces[Math.floor(Math.random() * colorFaces.length)]),
    numberDice: Array.from({ length: 3 }, () => numberFaces[Math.floor(Math.random() * numberFaces.length)])
  };
}

/** @param {string} id */
function parseCellId(id) {
  const cell = cellMap[id];
  return cell ?? null;
}

/** @param {string} first @param {string} second */
function areAdjacent(first, second) {
  const a = parseCellId(first);
  const b = parseCellId(second);
  if (!a || !b) return false;
  return Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
}

/** @param {string[]} ids */
function isConnectedGroup(ids) {
  if (ids.length <= 1) return true;
  const selected = new Set(ids);
  const seen = new Set([ids[0]]);
  const queue = [ids[0]];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const candidate of selected) {
      if (!seen.has(candidate) && areAdjacent(current, candidate)) {
        seen.add(candidate);
        queue.push(candidate);
      }
    }
  }

  return seen.size === selected.size;
}

/** @param {NochMalPlayer} player @param {string[]} pending */
function hasValidAnchor(player, pending) {
  if (pending.some((id) => parseCellId(id)?.column === 7)) {
    return true;
  }

  return pending.some((id) => player.checkedCells.some((checkedId) => areAdjacent(id, checkedId)));
}

/** @param {NochMalPlayer} player @param {Record<NochMalColor, NochMalBonusClaim>} colorBonusClaims @param {NochMalBonusClaim[]} columnBonusClaims */
function calculateScore(player, colorBonusClaims, columnBonusClaims) {
  const checked = new Set(player.checkedCells);
  const columnPoints = columnBonusClaims.reduce((sum, claims, column) => {
    if (claims.first.includes(player.id)) return sum + topScore[column];
    if (claims.normal.includes(player.id)) return sum + bottomScore[column];
    return sum;
  }, 0);
  const colorPoints = colors.reduce((sum, color) => {
    const claims = colorBonusClaims[color];
    if (claims.first.includes(player.id)) return sum + 5;
    if (claims.normal.includes(player.id)) return sum + 3;
    return sum;
  }, 0);
  const starPenalty = Object.values(cellMap).filter((cell) => cell.hasStar && !checked.has(cell.id)).length * -2;
  const jokerPenalty = 8 - player.usedJokers;
  const total = columnPoints + colorPoints + starPenalty + jokerPenalty;
  return { columnPoints, colorPoints, starPenalty, jokerPenalty, total };
}

/** @param {NochMalPlayer} player @param {NochMalColor} color */
function hasCompletedColor(player, color) {
  const checked = new Set(player.checkedCells);
  return Object.values(cellMap).filter((cell) => cell.color === color).every((cell) => checked.has(cell.id));
}

/** @param {NochMalPlayer} player */
function completedColorCount(player) {
  return colors.filter((color) => hasCompletedColor(player, color)).length;
}

/** @param {NochMalSession} session */
function normalizeSessionBonusClaims(session) {
  session.state.columnBonusClaims = Array.from({ length: 15 }, (_, index) => normalizeBonusClaim(session.state.columnBonusClaims?.[index]));
  for (const color of colors) {
    session.state.colorBonusClaims[color] = normalizeBonusClaim(session.state.colorBonusClaims[color]);
  }
}

/** @param {NochMalBonusClaim} claim @param {string} playerId */
function hasBonusClaim(claim, playerId) {
  return claim.first.includes(playerId) || claim.normal.includes(playerId);
}

/** @param {NochMalSession} session */
function refreshScores(session) {
  normalizeSessionBonusClaims(session);
  for (const player of session.players) {
    player.score = calculateScore(player, session.state.colorBonusClaims, session.state.columnBonusClaims);
  }
}

/** @param {NochMalPlayer} player @param {number} column */
function hasCompletedColumn(player, column) {
  const checked = new Set(player.checkedCells);
  return rows.every((_, row) => checked.has(`${row}-${column}`));
}

/** @param {NochMalSession} session */
function updateColumnBonusClaims(session) {
  normalizeSessionBonusClaims(session);

  for (let column = 0; column < 15; column += 1) {
    const claims = session.state.columnBonusClaims[column];
    const candidates = session.players.filter((player) => !hasBonusClaim(claims, player.id) && hasCompletedColumn(player, column));
    if (candidates.length === 0) continue;

    const target = claims.first.length === 0 ? claims.first : claims.normal;
    for (const player of candidates) target.push(player.id);
  }
}

/** @param {NochMalSession} session */
function updateColorBonusClaims(session) {
  normalizeSessionBonusClaims(session);

  for (const color of colors) {
    const claims = session.state.colorBonusClaims[color];
    const candidates = session.players.filter((player) => !hasBonusClaim(claims, player.id) && hasCompletedColor(player, color));
    if (candidates.length === 0) continue;

    const target = claims.first.length === 0 ? claims.first : claims.normal;
    for (const player of candidates) target.push(player.id);
  }
}

/** @param {NochMalSession} session */
function finishGame(session) {
  updateColumnBonusClaims(session);
  updateColorBonusClaims(session);
  refreshScores(session);
  const scores = session.players.map((player) => ({ playerId: player.id, score: player.score.total, breakdown: player.score }));
  const highest = Math.max(...scores.map((score) => score.score));
  const tiedPlayerIds = scores.filter((score) => score.score === highest).map((score) => score.playerId);
  const bestRemainingJokers = Math.max(...tiedPlayerIds.map((id) => 8 - (session.players.find((player) => player.id === id)?.usedJokers ?? 8)));
  const winnerIds = tiedPlayerIds.filter((id) => 8 - (session.players.find((player) => player.id === id)?.usedJokers ?? 8) === bestRemainingJokers);
  session.state.phase = 'finished';
  session.state.winnerIds = winnerIds;
  session.state.winnerId = winnerIds.length === 1 ? winnerIds[0] : null;
  session.state.isDraw = winnerIds.length !== 1;
  session.state.roundScores = scores;
  session.status = 'finished';
}

/** @param {NochMalSession} session */
function nextActivePlayerId(session) {
  const currentIndex = session.players.findIndex((player) => player.id === session.state.activePlayerId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % session.players.length : 0;
  return session.players[nextIndex]?.id ?? null;
}

/** @param {NochMalSession} session */
function startNextRound(session) {
  updateColumnBonusClaims(session);
  updateColorBonusClaims(session);
  refreshScores(session);

  if (session.players.some((player) => completedColorCount(player) >= 2)) {
    finishGame(session);
    return;
  }

  session.state.round += 1;
  session.state.roll = rollDice();
  session.state.phase = 'selecting-dice';
  session.state.confirmedPlayerIds = [];
  session.state.activePlayerId = nextActivePlayerId(session);
  session.state.activeColorDieIndex = null;
  session.state.activeNumberDieIndex = null;
  for (const player of session.players) {
    player.selectedColor = null;
    player.selectedNumber = null;
    player.selectedColorDieIndex = null;
    player.selectedNumberDieIndex = null;
    player.pendingCells = [];
    player.confirmed = false;
    player.skipped = false;
  }
}

/** @param {NochMalSession} session */
function maybeAdvanceRound(session) {
  if (session.players.every((player) => player.confirmed)) {
    startNextRound(session);
    return;
  }
  session.state.phase = 'waiting';
}

/** @param {BasicPlayer[]} players @returns {NochMalSession | { error: string }} */
export function createNochMalSession(players) {
  const selectedPlayers = players.slice(0, nochMalGame.maxPlayers);

  if (selectedPlayers.length < nochMalGame.minPlayers) {
    return { error: 'Noch mal braucht mindestens einen Spieler.' };
  }

  /** @type {Record<NochMalColor, NochMalBonusClaim>} */
  const colorBonusClaims = { lime: emptyBonusClaim(), yellow: emptyBonusClaim(), blue: emptyBonusClaim(), pink: emptyBonusClaim(), peach: emptyBonusClaim() };

  return {
    id: crypto.randomUUID(),
    gameId: 'noch-mal',
    name: nochMalGame.name,
    status: 'running',
    createdAt: new Date().toISOString(),
    players: selectedPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      checkedCells: [],
      usedJokers: 0,
      selectedColor: null,
      selectedNumber: null,
      selectedColorDieIndex: null,
      selectedNumberDieIndex: null,
      pendingCells: [],
      confirmed: false,
      skipped: false,
      score: emptyScore()
    })),
    state: {
      phase: 'selecting-dice',
      round: 1,
      roll: rollDice(),
      confirmedPlayerIds: [],
      activePlayerId: selectedPlayers[0]?.id ?? null,
      activeColorDieIndex: null,
      activeNumberDieIndex: null,
      colorBonusClaims,
      columnBonusClaims: Array.from({ length: 15 }, () => emptyBonusClaim()),
      winnerIds: [],
      winnerId: null,
      isDraw: false,
      roundScores: []
    }
  };
}

/** @param {NochMalSession} session */
function isAdvantageRound(session) {
  return session.state.round >= 4;
}

/** @param {NochMalSession} session */
function hasActiveSelection(session) {
  return session.state.activeColorDieIndex !== null && session.state.activeNumberDieIndex !== null;
}

/** @param {NochMalSession} session @param {string} playerId @param {number} colorDieIndex @param {number} numberDieIndex */
function validateDiceAvailability(session, playerId, colorDieIndex, numberDieIndex) {
  if (!isAdvantageRound(session)) return '';

  const isActivePlayer = session.state.activePlayerId === playerId;
  const activePlayer = session.players.find((player) => player.id === session.state.activePlayerId);
  const activePlayerSkipped = Boolean(activePlayer?.skipped && activePlayer.confirmed && !hasActiveSelection(session));

  if (!hasActiveSelection(session)) {
    if (activePlayerSkipped) return '';
    return isActivePlayer ? '' : 'Warte auf die Auswahl des Startspielers.';
  }

  if (isActivePlayer) {
    return 'Der Startspieler hat seine Wuerfel bereits gewaehlt.';
  }

  if (colorDieIndex === session.state.activeColorDieIndex || numberDieIndex === session.state.activeNumberDieIndex) {
    return 'Diese Wuerfel wurden vom Startspieler entfernt.';
  }

  return '';
}

/** @param {NochMalPlayer} player @param {string[]} candidate */
function validateCandidateGroup(player, candidate) {
  if (!isConnectedGroup(candidate)) return 'Die Felder muessen orthogonal zusammenhaengen.';
  if (!hasValidAnchor(player, candidate)) {
    return player.checkedCells.length === 0
      ? 'Der Zug muss in der mittleren H-Spalte beginnen.'
      : 'Der Zug muss an deine bestehenden Kreuze anschliessen oder die H-Spalte beruehren.';
  }
  return '';
}

/** @param {NochMalPlayer} player @param {string} cellId */
function validatePendingCell(player, cellId) {
  const cell = parseCellId(cellId);
  if (!cell) return 'Dieses Feld ist ungueltig.';
  if (!player.selectedColor || !player.selectedNumber) return 'Waehle zuerst einen Farb- und einen Zahlenwuerfel.';
  if (player.checkedCells.includes(cellId)) return 'Dieses Feld ist bereits angekreuzt.';
  if (cell.color !== player.selectedColor) return 'Dieses Feld hat nicht die gewaehlte Farbe.';
  if (!player.pendingCells.includes(cellId) && player.pendingCells.length >= player.selectedNumber) return 'Du hast bereits genug Felder ausgewaehlt.';

  const candidate = player.pendingCells.includes(cellId) ? player.pendingCells : [...player.pendingCells, cellId];
  return validateCandidateGroup(player, candidate);
}

/** @param {NochMalPlayer} player */
function validatePendingMove(player) {
  if (!player.selectedColor || !player.selectedNumber) return 'Waehle zuerst einen Farb- und einen Zahlenwuerfel.';
  if (player.pendingCells.length !== player.selectedNumber) return `Markiere genau ${player.selectedNumber} Feld(er).`;
  if (!isConnectedGroup(player.pendingCells)) return 'Die Felder muessen orthogonal zusammenhaengen.';
  if (!hasValidAnchor(player, player.pendingCells)) return player.checkedCells.length === 0 ? 'Dein erster Zug muss die mittlere H-Spalte beruehren.' : 'Die Auswahl muss an deine bestehenden Kreuze anschliessen oder die H-Spalte beruehren.';
  return '';
}

/** @param {NochMalSession} session @param {string} playerId @param {NochMalMove} move */
export function makeNochMalMove(session, playerId, move) {
  if (session.status !== 'running') return { error: 'Dieses Spiel ist bereits beendet.' };
  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) return { error: 'Du schaust diese Noch-mal-Runde nur zu.' };
  if (player.confirmed) return { error: 'Du hast diese Runde bereits bestaetigt.' };

  const type = String(move.type ?? '');

  if (type === 'select-dice' || type === 'select-dice-and-toggle-cell') {
    const colorDieIndex = Number(move.colorDieIndex);
    const numberDieIndex = Number(move.numberDieIndex);
    if (!Number.isInteger(colorDieIndex) || colorDieIndex < 0 || colorDieIndex >= session.state.roll.colorDice.length) return { error: 'Dieser Farbwürfel ist ungueltig.' };
    if (!Number.isInteger(numberDieIndex) || numberDieIndex < 0 || numberDieIndex >= session.state.roll.numberDice.length) return { error: 'Dieser Zahlenwürfel ist ungueltig.' };

    const availabilityError = validateDiceAvailability(session, playerId, colorDieIndex, numberDieIndex);
    if (availabilityError) return { error: availabilityError };

    const colorFace = session.state.roll.colorDice[colorDieIndex];
    const numberFace = session.state.roll.numberDice[numberDieIndex];
    const selectedColor = colorFace === 'joker' ? String(move.color ?? '') : colorFace;
    const selectedNumber = numberFace === 'joker' ? Number(move.number) : numberFace;
    if (!colors.includes(/** @type {NochMalColor} */ (selectedColor))) return { error: 'Waehle eine gueltige Jokerfarbe.' };
    if (!Number.isInteger(selectedNumber) || selectedNumber < 1 || selectedNumber > 5) return { error: 'Waehle eine gueltige Jokerzahl.' };

    const jokerCost = (colorFace === 'joker' ? 1 : 0) + (numberFace === 'joker' ? 1 : 0);
    if (player.usedJokers + jokerCost > 8) return { error: 'Du hast nicht mehr genug Joker.' };

    player.selectedColor = /** @type {NochMalColor} */ (selectedColor);
    player.selectedNumber = Number(selectedNumber);
    player.selectedColorDieIndex = colorDieIndex;
    player.selectedNumberDieIndex = numberDieIndex;
    player.pendingCells = [];
    session.state.phase = 'selecting-cells';

    if (isAdvantageRound(session) && session.state.activePlayerId === playerId && !hasActiveSelection(session)) {
      session.state.activeColorDieIndex = colorDieIndex;
      session.state.activeNumberDieIndex = numberDieIndex;
    }

    if (type === 'select-dice-and-toggle-cell') {
      const cellId = String(move.cellId ?? '');
      const error = validatePendingCell(player, cellId);
      if (error) return { error };
      player.pendingCells = [cellId];
    }

    return { session };
  }

  if (type === 'toggle-cell') {
    const cellId = String(move.cellId ?? '');
    const pendingIndex = player.pendingCells.indexOf(cellId);
    if (pendingIndex >= 0) {
      player.pendingCells = player.pendingCells.filter((id) => id !== cellId);
      return { session };
    }

    const error = validatePendingCell(player, cellId);
    if (error) return { error };
    player.pendingCells = [...player.pendingCells, cellId];
    return { session };
  }

  if (type === 'clear-selection') {
    player.pendingCells = [];
    return { session };
  }

  if (type === 'skip-turn') {
    player.pendingCells = [];
    player.skipped = true;
    player.confirmed = true;
    session.state.confirmedPlayerIds = [...new Set([...session.state.confirmedPlayerIds, player.id])];
    maybeAdvanceRound(session);
    return { session };
  }

  if (type === 'confirm-turn') {
    const error = validatePendingMove(player);
    if (error) return { error };
    const colorFace = player.selectedColorDieIndex === null ? null : session.state.roll.colorDice[player.selectedColorDieIndex];
    const numberFace = player.selectedNumberDieIndex === null ? null : session.state.roll.numberDice[player.selectedNumberDieIndex];
    player.usedJokers += (colorFace === 'joker' ? 1 : 0) + (numberFace === 'joker' ? 1 : 0);
    player.checkedCells = [...player.checkedCells, ...player.pendingCells];
    player.pendingCells = [];
    player.confirmed = true;
    session.state.confirmedPlayerIds = [...new Set([...session.state.confirmedPlayerIds, player.id])];
    maybeAdvanceRound(session);
    return { session };
  }

  return { error: 'Diese Noch-mal-Aktion ist nicht bekannt.' };
}













