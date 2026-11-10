/** Destinations reached by consecutive moves of one checker in legal full turns.
 * Input turns already match the moves played so far. Prefer fewer dice for an
 * ambiguous destination (especially bearoff); ties follow the chosen dice order.
 */
export function checkerDestinations(turns, offset, from) {
  const destinations = new Map();
  for (const turn of turns) {
    const path = [];
    let location = from;
    for (const move of turn.moves.slice(offset)) {
      if (move.from !== location) break;
      path.push(move);
      const previous = destinations.get(move.to);
      if (!previous || path.length < previous.length) destinations.set(move.to, [...path]);
      if (move.to === 24) break;
      location = move.to;
    }
  }
  return destinations;
}
