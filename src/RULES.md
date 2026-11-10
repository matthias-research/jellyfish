# Rules engine API

`rules.js` is a pure ES module without browser dependencies. Input states are never mutated.

## Coordinates

Players are `1` (white) and `-1` (black). `board.points` contains 24 signed counts. White moves from index 23 toward index 0, with home at 0–5; black moves toward 23, with home at 18–23. `board.bar` and `board.off` are two-element arrays indexed white then black. A legal board has 15 checkers per player across points, bar, and off.

Move records are `{from,to,die,hit}`. Point coordinates are 0–23. `from=-1` means entering from the bar; `to=24` means bearing off. These special coordinates are exported as `BAR` and `OFF`.

## Playing a turn

`initialBoard()` creates the standard position. `cloneBoard(board)` copies a position. `legalTurns(board,player,[die1,die2])` returns `{moves,board}` objects for every legal complete sequence. It expands doubles into four uses, requires the maximum playable number of dice, and requires the higher die when only one distinct die can be played. Both dice orders are considered. Different paths to the same position are retained for interactive move entry. A pass has one result with an empty `moves` array.

The interface should retain the legal complete sequences and filter them as each move is entered. `applyMove(board,player,move)` validates only the individual checker step, not global dice-use constraints. Using it alone to validate a completed turn is insufficient.

`pipCount(board,player)` includes checkers on the bar. `winner(board)` returns a player or `null`; `winMultiplier(board)` returns 0 while unfinished, otherwise 1, 2, or 3 for a single, gammon, or backgammon. `validateBoard(board)` checks board shape and checker conservation and throws on invalid input.

## Match flow

`createMatch(target=7)` returns `{target,scores,game,cube,cubeOwner,crawford,crawfordUsed,pendingDouble,result,matchWinner}`. Target 0 means money play. A one-point match immediately uses Crawford restrictions.

`offerDouble(match,player)` records an offer; `respondDouble(match,true)` doubles the cube and assigns ownership to the accepting player. Passing `false` awards the offering player the previous cube value. `canDouble(match,player)` checks cube ownership and match/Crawford status. The interface must additionally enforce that offers occur on the offerer's turn before rolling.

`finishGame(match,board)` awards the winner cube × win multiplier. `resignGame(match,resigningPlayer,multiplier=1)` awards an agreed resignation; the interface must obtain acceptance first. Results have `{winner,points,multiplier,reason}`. Once a result is recorded, duplicate scoring throws. `startGame(match)` resets the cube and advances the game, scheduling exactly one Crawford game after either player first reaches one-away. It throws after a match winner is established.

`rollDice(random=Math.random)` returns two independent dice. `openingRoll(random)` returns `{dice,player}` where a tied opening roll has `player:null` and must be rerolled. The winner uses these opening dice; do not roll a fresh pair for the first move.

The generator follows the recovered Jellyfish pattern of considering both orders for distinct dice, four uses for doubles, bar priority, and retaining maximal move sequences. Its behavioral tests cover standard rules and seeded complete matches. Native executable parity, original dice RNG, optional Jacoby/beaver rules, and original match equity/cube strategy have not been established by these tests.
