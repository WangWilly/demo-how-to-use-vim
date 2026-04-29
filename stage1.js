import React, { useState, useEffect, useRef } from 'react';

// 初始化預設文本
const initialText = [
  "Welcome to Vim Visual Practice Tool!",
  "",
  "1. 基礎移動 (Normal Mode):",
  "   使用 j (下), k (上), h (左), l (右) 來移動游標。",
  "   試著把游標移動到這一行。",
  "",
  "2. 進入與退出輸入模式:",
  "   按 i 可以進入 [插入模式] 並開始打字。",
  "   打完字後，按 Esc 鍵回到 [一般模式]。",
  "",
  "3. 快速跳躍:",
  "   按 w 可以跳到下一個單字 (word)。",
  "   按 b 可以跳回上一個單字 (back)。",
  "   按 0 跳到行首，按 $ 跳到行尾。",
  "",
  "4. 刪除與修改 (動詞):",
  "   按 x 可以刪除游標所在的一個字元。",
  "   連續按兩下 d (也就是 dd) 可以刪除整行。",
  "   按 d 再按 w (dw) 可以刪除一個單字。",
  "",
  "5. 復原:",
  "   糟糕，刪錯了？在一般模式下按 u 可以復原 (Undo)。",
  "",
  "準備好了嗎？開始你的駭客之旅吧！"
];

const VimPracticeTool = () => {
  const [text, setText] = useState([...initialText]);
  const [cursor, setCursor] = useState({ line: 0, col: 0 });
  const [mode, setMode] = useState('NORMAL'); // NORMAL, INSERT
  const [commandBuffer, setCommandBuffer] = useState('');
  const [history, setHistory] = useState([]); // 儲存文本與游標狀態用於 Undo
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);

  // 儲存狀態以供復原
  const saveHistory = () => {
    setHistory(prev => [...prev, { text: [...text], cursor: { ...cursor } }]);
  };

  // 游標邊界檢查與輔助函數
  const clampCol = (lineIdx, colIdx, currentText = text, currentMode = mode) => {
    const lineStr = currentText[lineIdx] || "";
    // Normal 模式下，游標不能停在行尾換行符上（長度-1），除非是空行
    // Insert 模式下，游標可以停在字串最後面（長度）
    const maxCol = currentMode === 'INSERT' ? lineStr.length : Math.max(0, lineStr.length - 1);
    return Math.max(0, Math.min(colIdx, maxCol));
  };

  // 處理鍵盤事件
  const handleKeyDown = (e) => {
    if (!isFocused) return;
    
    // 防止瀏覽器預設快捷鍵干擾 (例如空白鍵向下捲動、Backspace 回上一頁)
    if ([' ', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || 
        (e.key === 'd' && e.ctrlKey)) {
      e.preventDefault();
    }

    if (mode === 'NORMAL') {
      handleNormalModeKey(e);
    } else if (mode === 'INSERT') {
      handleInsertModeKey(e);
    }
  };

  // ----- 一般模式邏輯 -----
  const handleNormalModeKey = (e) => {
    const { key } = e;
    let newCursor = { ...cursor };
    let newText = [...text];
    let newBuffer = commandBuffer;

    // Esc 鍵：清除 Buffer
    if (key === 'Escape') {
      setCommandBuffer('');
      return;
    }

    // 處理已存在 Buffer 的情況 (組合鍵，如 dd, dw)
    if (newBuffer === 'd') {
      if (key === 'd') {
        // dd: 刪除當前行
        saveHistory();
        newText.splice(cursor.line, 1);
        if (newText.length === 0) newText.push(""); // 保持至少一行
        newCursor.line = Math.min(cursor.line, newText.length - 1);
        newCursor.col = clampCol(newCursor.line, 0, newText, 'NORMAL');
        setText(newText);
        setCursor(newCursor);
        setCommandBuffer('');
        return;
      } else if (key === 'w') {
        // dw: 刪除到下個單字
        saveHistory();
        const lineStr = newText[cursor.line];
        let nextSpace = lineStr.indexOf(' ', cursor.col);
        if (nextSpace === -1) nextSpace = lineStr.length; // 如果沒有空白，刪到行尾
        // 如果游標已經在空白上，刪除空白
        if (lineStr[cursor.col] === ' ') nextSpace = cursor.col + 1;
        
        newText[cursor.line] = lineStr.substring(0, cursor.col) + lineStr.substring(nextSpace);
        newCursor.col = clampCol(cursor.line, cursor.col, newText, 'NORMAL');
        setText(newText);
        setCursor(newCursor);
        setCommandBuffer('');
        return;
      } else {
        // 取消或無效指令
        setCommandBuffer('');
        return;
      }
    }

    // 處理單鍵指令
    switch (key) {
      case 'h': // 左
      case 'ArrowLeft':
        newCursor.col = Math.max(0, cursor.col - 1);
        break;
      case 'l': // 右
      case 'ArrowRight':
        newCursor.col = clampCol(cursor.line, cursor.col + 1, text, 'NORMAL');
        break;
      case 'j': // 下
      case 'ArrowDown':
        newCursor.line = Math.min(text.length - 1, cursor.line + 1);
        newCursor.col = clampCol(newCursor.line, cursor.col, text, 'NORMAL');
        break;
      case 'k': // 上
      case 'ArrowUp':
        newCursor.line = Math.max(0, cursor.line - 1);
        newCursor.col = clampCol(newCursor.line, cursor.col, text, 'NORMAL');
        break;
      case 'w': { // 下一個單字
        const lineStr = text[cursor.line];
        let nextIdx = cursor.col + 1;
        while (nextIdx < lineStr.length && lineStr[nextIdx] !== ' ') {
          nextIdx++;
        }
        while (nextIdx < lineStr.length && lineStr[nextIdx] === ' ') {
          nextIdx++;
        }
        if (nextIdx >= lineStr.length && cursor.line < text.length - 1) {
          newCursor.line += 1;
          newCursor.col = 0;
        } else {
          newCursor.col = clampCol(cursor.line, nextIdx, text, 'NORMAL');
        }
        break;
      }
      case 'b': { // 上一個單字
        let prevIdx = cursor.col - 1;
        const lineStr = text[cursor.line];
        while (prevIdx >= 0 && lineStr[prevIdx] === ' ') {
          prevIdx--;
        }
        while (prevIdx >= 0 && lineStr[prevIdx] !== ' ') {
          prevIdx--;
        }
        if (prevIdx < 0 && cursor.line > 0) {
          newCursor.line -= 1;
          newCursor.col = clampCol(newCursor.line, text[newCursor.line].length, text, 'NORMAL');
        } else {
          newCursor.col = prevIdx + 1;
        }
        break;
      }
      case '0': // 行首
        newCursor.col = 0;
        break;
      case '$': // 行尾
        newCursor.col = clampCol(cursor.line, text[cursor.line].length, text, 'NORMAL');
        break;
      case 'i': // 插入模式 (游標前)
        setMode('INSERT');
        return;
      case 'a': // 插入模式 (游標後)
        newCursor.col = Math.min(text[cursor.line].length, cursor.col + 1);
        setCursor(newCursor);
        setMode('INSERT');
        return;
      case 'A': // 行尾插入
        newCursor.col = text[cursor.line].length;
        setCursor(newCursor);
        setMode('INSERT');
        return;
      case 'I': // 行首插入
        newCursor.col = 0;
        setCursor(newCursor);
        setMode('INSERT');
        return;
      case 'o': // 下方新增一行並插入
        saveHistory();
        newText.splice(cursor.line + 1, 0, "");
        newCursor.line += 1;
        newCursor.col = 0;
        setText(newText);
        setCursor(newCursor);
        setMode('INSERT');
        return;
      case 'x': // 刪除字元
        if (text[cursor.line].length > 0) {
          saveHistory();
          const lineStr = newText[cursor.line];
          newText[cursor.line] = lineStr.slice(0, cursor.col) + lineStr.slice(cursor.col + 1);
          newCursor.col = clampCol(cursor.line, cursor.col, newText, 'NORMAL');
          setText(newText);
        }
        break;
      case 'd': // 啟動刪除組合鍵
        setCommandBuffer('d');
        return;
      case 'u': // 復原 Undo
        if (history.length > 0) {
          const lastState = history[history.length - 1];
          setText(lastState.text);
          setCursor(lastState.cursor);
          setHistory(history.slice(0, -1));
        }
        break;
      default:
        // 忽略其他鍵
        break;
    }
    
    setCursor(newCursor);
  };

  // ----- 插入模式邏輯 -----
  const handleInsertModeKey = (e) => {
    const { key } = e;
    let newCursor = { ...cursor };
    let newText = [...text];

    if (key === 'Escape') {
      setMode('NORMAL');
      // Vim 在離開插入模式時，游標通常會往左退一格
      setCursor({ ...cursor, col: Math.max(0, cursor.col - 1) });
      return;
    }

    saveHistory(); // 打字前儲存狀態以供復原 (這裡簡化為每個動作都存，實際 Vim 是存一段編輯)

    if (key === 'Backspace') {
      if (cursor.col > 0) {
        // 刪除游標前的字元
        const lineStr = newText[cursor.line];
        newText[cursor.line] = lineStr.slice(0, cursor.col - 1) + lineStr.slice(cursor.col);
        newCursor.col -= 1;
        setText(newText);
        setCursor(newCursor);
      } else if (cursor.line > 0) {
        // 刪除換行符，與上一行合併
        const prevLineLen = newText[cursor.line - 1].length;
        newText[cursor.line - 1] += newText[cursor.line];
        newText.splice(cursor.line, 1);
        newCursor.line -= 1;
        newCursor.col = prevLineLen;
        setText(newText);
        setCursor(newCursor);
      }
    } else if (key === 'Enter') {
      // 換行
      const lineStr = newText[cursor.line];
      const nextLineStr = lineStr.slice(cursor.col);
      newText[cursor.line] = lineStr.slice(0, cursor.col);
      newText.splice(cursor.line + 1, 0, nextLineStr);
      newCursor.line += 1;
      newCursor.col = 0;
      setText(newText);
      setCursor(newCursor);
    } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // 輸入一般字元 (包含空白)
      const lineStr = newText[cursor.line];
      newText[cursor.line] = lineStr.slice(0, cursor.col) + key + lineStr.slice(cursor.col);
      newCursor.col += 1;
      setText(newText);
      setCursor(newCursor);
    } else {
      // 移除未使用的歷史紀錄避免堆疊過多垃圾
      setHistory(prev => prev.slice(0, -1));
    }
  };

  // ----- 渲染編輯器內容 -----
  const renderText = () => {
    return text.map((line, lineIdx) => {
      const isCurrentLine = cursor.line === lineIdx;
      
      // 處理空行
      if (line.length === 0) {
        if (isCurrentLine) {
          return (
            <div key={lineIdx} className={`h-6 leading-6 ${isCurrentLine ? 'bg-gray-800' : ''}`}>
              <span className={`inline-block ${mode === 'NORMAL' ? 'bg-green-400 opacity-80 w-2.5 h-5 align-middle' : 'border-l-2 border-green-400 h-5 inline-block align-middle'}`}>&nbsp;</span>
            </div>
          );
        }
        return <div key={lineIdx} className="h-6 leading-6">&nbsp;</div>;
      }

      // 處理有文字的行
      const chars = line.split('');
      // 在行尾加上一個虛擬字元，讓 INSERT 模式的游標可以停在字串最後
      if (mode === 'INSERT' && isCurrentLine && cursor.col === line.length) {
        chars.push(''); 
      }

      return (
        <div key={lineIdx} className={`h-6 leading-6 whitespace-pre font-mono ${isCurrentLine ? 'bg-gray-800/80' : ''}`}>
          {chars.map((char, colIdx) => {
            const isCursor = isCurrentLine && cursor.col === colIdx;
            
            // 決定游標樣式
            let cursorClass = '';
            if (isCursor) {
              if (mode === 'NORMAL') {
                cursorClass = 'bg-green-400 text-gray-900 font-bold'; // 方塊游標
              } else if (mode === 'INSERT') {
                // 插入模式下，如果是行尾的虛擬字元，顯示粗線條
                if (char === '') {
                  cursorClass = 'border-l-2 border-green-400 animate-pulse';
                } else {
                  cursorClass = 'border-l-2 border-green-400 -ml-[2px] animate-pulse'; // 線條游標
                }
              }
            }

            return (
              <span key={colIdx} className={cursorClass}>
                {char === ' ' ? '\u00A0' : char}
                {char === '' && '\u00A0'}
              </span>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-950 text-gray-300 font-sans">
      
      {/* 左側：編輯器區域 */}
      <div className="flex-1 p-4 md:p-8 flex flex-col min-h-[60vh] relative">
        <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center">
          <span className="text-green-500 mr-2">➜</span> Vim 終端機模擬
        </h2>
        
        {/* 編輯器容器 */}
        <div 
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`flex-1 bg-gray-900 border-2 rounded-lg p-4 overflow-y-auto outline-none transition-colors duration-200 ${
            isFocused ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-gray-700'
          }`}
        >
          {/* 未聚焦時的提示遮罩 */}
          {!isFocused && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm rounded-lg mx-4 md:mx-8 mt-12 mb-16 border border-gray-800">
              <div className="bg-gray-800 px-6 py-4 rounded-xl shadow-2xl text-center cursor-pointer hover:bg-gray-700 transition" onClick={() => containerRef.current?.focus()}>
                <div className="text-3xl mb-2">🖱️</div>
                <p className="text-xl font-bold text-white">點擊此處開始練習</p>
                <p className="text-gray-400 text-sm mt-2">進入焦點模式以捕捉鍵盤事件</p>
              </div>
            </div>
          )}

          <div className="font-mono text-base tracking-wide">
            {renderText()}
          </div>
        </div>

        {/* 狀態列 StatusBar */}
        <div className="mt-2 flex items-center justify-between bg-gray-800 px-4 py-2 rounded-md font-mono text-sm border border-gray-700">
          <div className="flex items-center space-x-4">
            <span className={`font-bold px-2 py-1 rounded ${
              mode === 'NORMAL' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {mode === 'NORMAL' ? '-- NORMAL --' : '-- INSERT --'}
            </span>
            {commandBuffer && (
              <span className="text-yellow-400 bg-gray-700 px-2 py-1 rounded">
                等待輸入: {commandBuffer}_
              </span>
            )}
          </div>
          <div className="text-gray-400">
            行 {cursor.line + 1}, 列 {cursor.col + 1}
          </div>
        </div>
      </div>

      {/* 右側：教學與小抄 */}
      <div className="w-full md:w-80 bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-6 border-b border-gray-700 pb-2">📖 Vim 隨身小抄</h3>
        
        <div className="space-y-6">
          {/* 模式切換 */}
          <div className={`p-4 rounded-lg border ${mode === 'INSERT' ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-800 border-gray-700'}`}>
            <h4 className="font-bold text-white mb-2">🔄 模式切換</h4>
            <ul className="text-sm space-y-2 text-gray-400">
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">i</kbd> 進入插入模式打字</li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">Esc</kbd> 回到一般模式</li>
            </ul>
          </div>

          {/* 移動 */}
          <div className={`p-4 rounded-lg border ${mode === 'NORMAL' ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800 border-gray-700'}`}>
            <h4 className="font-bold text-white mb-2">🧭 基礎移動 (一般模式)</h4>
            <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4 font-mono">
              <div></div>
              <div className="bg-gray-700 text-white rounded p-1">k<br/><span className="text-xs text-gray-400">上</span></div>
              <div></div>
              <div className="bg-gray-700 text-white rounded p-1">h<br/><span className="text-xs text-gray-400">左</span></div>
              <div className="bg-gray-700 text-white rounded p-1">j<br/><span className="text-xs text-gray-400">下</span></div>
              <div className="bg-gray-700 text-white rounded p-1">l<br/><span className="text-xs text-gray-400">右</span></div>
            </div>
            <ul className="text-sm space-y-2 text-gray-400">
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">w</kbd> 跳至下個單字</li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">b</kbd> 跳至上個單字</li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">0</kbd> 行首 / <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">$</kbd> 行尾</li>
            </ul>
          </div>

          {/* 編輯 */}
          <div className="p-4 rounded-lg border bg-gray-800 border-gray-700">
            <h4 className="font-bold text-white mb-2">✂️ 快速編輯 (一般模式)</h4>
            <ul className="text-sm space-y-2 text-gray-400">
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">x</kbd> 刪除游標上的字</li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">dd</kbd> 刪除整行</li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">dw</kbd> 刪除一個單字</li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">o</kbd> 在下方開新行並輸入</li>
              <li><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white font-mono">u</kbd> 復原 (Undo)</li>
            </ul>
          </div>
          
          <div className="text-xs text-gray-500 text-center mt-8">
            *請確保輸入法為英文狀態以獲得最佳體驗
          </div>
        </div>
      </div>
    </div>
  );
};

export default VimPracticeTool;
