import { useEffect, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { RefreshCw, Trophy } from 'lucide-react'

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const glyphs: Record<string, string> = { wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔', bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚' }
const winLines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
type Mark = 'X' | 'O'
type TicResult = Mark | 'draw' | null

function getTicResult(cells: (Mark | null)[]): TicResult {
  for (const [a, b, c] of winLines) if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a]
  return cells.every(Boolean) ? 'draw' : null
}

function chooseKiraMove(cells: (Mark | null)[]) {
  const open = cells.map((cell, index) => cell ? -1 : index).filter(index => index >= 0)
  const moveFor = (mark: Mark) => open.find(index => { const probe = [...cells]; probe[index] = mark; return getTicResult(probe) === mark })
  return moveFor('O') ?? moveFor('X') ?? (cells[4] ? open[Math.floor(Math.random() * open.length)] : 4)
}

export function ArcadeLounge() {
  const chess = useRef(new Chess())
  const [fen, setFen] = useState(chess.current.fen())
  const [selected, setSelected] = useState<string | null>(null)
  const [notice, setNotice] = useState('Your move — white to fly.')
  const [board, setBoard] = useState<(Mark | null)[]>(Array(9).fill(null))
  const [turn, setTurn] = useState<Mark>('X')
  const [ticResult, setTicResult] = useState<TicResult>(null)

  const legal = selected ? chess.current.moves({ square: selected as Square, verbose: true }).map(move => move.to) : []
  const resetChess = () => { chess.current = new Chess(); setFen(chess.current.fen()); setSelected(null); setNotice('Fresh board. White moves first.') }
  const respond = () => window.setTimeout(() => {
    if (chess.current.isGameOver()) return
    const moves = chess.current.moves()
    const choice = moves[Math.floor(Math.random() * moves.length)]
    chess.current.move(choice)
    setFen(chess.current.fen()); setNotice(chess.current.isCheckmate() ? `Kira played ${choice}. Checkmate.` : `Kira played ${choice}. Your turn.`)
  }, 420)
  const moveChess = (square: string) => {
    const piece = chess.current.get(square as Square)
    if (!selected && piece?.color === 'w' && chess.current.turn() === 'w') { setSelected(square); return }
    if (selected && legal.includes(square as Square)) {
      chess.current.move({ from: selected as Square, to: square as Square, promotion: 'q' })
      setSelected(null); setFen(chess.current.fen()); setNotice(`Vector locked: ${square}.`); respond(); return
    }
    setSelected(piece?.color === 'w' ? square : null)
  }

  const resetTicTacToe = () => { setBoard(Array(9).fill(null)); setTurn('X'); setTicResult(null) }
  const playTicTacToe = (index: number) => {
    if (board[index] || turn !== 'X' || ticResult) return
    const afterPlayer = [...board]; afterPlayer[index] = 'X'
    const playerResult = getTicResult(afterPlayer)
    setBoard(afterPlayer)
    if (playerResult) { setTicResult(playerResult); return }
    setTurn('O')
    window.setTimeout(() => {
      const kiraIndex = chooseKiraMove(afterPlayer)
      const afterKira = [...afterPlayer]; afterKira[kiraIndex] = 'O'
      setBoard(afterKira); setTicResult(getTicResult(afterKira)); setTurn('X')
    }, 380)
  }
  useEffect(() => {
    if (!ticResult) return
    const timer = window.setTimeout(resetTicTacToe, 1800)
    return () => window.clearTimeout(timer)
  }, [ticResult])

  const ticMessage = ticResult === 'X' ? 'You win! Kira is recalibrating the board…' : ticResult === 'O' ? 'Kira wins this orbit. New board incoming…' : ticResult === 'draw' ? 'Stalemate. New board incoming…' : turn === 'O' ? 'Kira is calculating…' : 'Your turn — place X.'
  return <section className="arcade-lounge">
    <div className="arcade-chess-head"><div><span>SIDEBAY // HIDDEN QUEST ARCADE</span><h2>STARBOARD CHESS</h2><p>{notice}</p></div><button onClick={resetChess}><RefreshCw size={15} /> New board</button></div>
    <div className="chess-board" data-position={fen} role="grid" aria-label="Playable chess side quest">{chess.current.board().map((rank, row) => rank.map((piece, col) => { const square = `${files[col]}${8 - row}`; const squareRef = square as Square; const key = piece ? `${piece.color}${piece.type}` : ''; return <button role="gridcell" aria-label={piece ? `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : square} onClick={() => moveChess(square)} className={`${(row + col) % 2 ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${legal.includes(squareRef) ? 'legal' : ''}`} key={square}>{piece && glyphs[key]}{legal.includes(squareRef) && <i />}</button> }))}</div>
    <div className="arcade-tic"><div><span>NEBULA NINES</span><b><Trophy size={15} /> TIC-TAC-TOE</b><small>{ticMessage}</small></div><div className="arcade-tic-board" aria-label="Play Tic-Tac-Toe against Kira">{board.map((cell, index) => <button aria-label={`Square ${index + 1}${cell ? `: ${cell}` : ''}`} disabled={Boolean(cell) || turn === 'O' || Boolean(ticResult)} onClick={() => playTicTacToe(index)} key={index}>{cell}</button>)}</div><button className="reset-tic" onClick={resetTicTacToe}>Reset side quest</button></div>
  </section>
}
