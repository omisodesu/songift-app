import { useState, useCallback } from 'react';

/**
 * 星評価コンポーネント
 * @param {Object} props
 * @param {number} props.value - 現在の評価値 (1-5)
 * @param {function} props.onChange - 評価変更時のコールバック
 * @param {boolean} props.readOnly - 読み取り専用モード
 * @param {string} props.size - サイズ ('sm' | 'md' | 'lg')
 */
const StarRating = ({ value = 0, onChange, readOnly = false, size = 'md' }) => {
  const [hoverValue, setHoverValue] = useState(0);

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const handleClick = useCallback(
    (rating) => {
      if (!readOnly && onChange) {
        onChange(rating);
      }
    },
    [readOnly, onChange]
  );

  const handleKeyDown = useCallback(
    (e, rating) => {
      if (readOnly) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(rating);
      } else if (e.key === 'ArrowRight' && rating < 5) {
        e.preventDefault();
        handleClick(rating + 1);
      } else if (e.key === 'ArrowLeft' && rating > 1) {
        e.preventDefault();
        handleClick(rating - 1);
      }
    },
    [readOnly, handleClick]
  );

  const renderStar = (rating) => {
    const isFilled = rating <= (hoverValue || value);
    const starClass = `${sizeClasses[size]} ${
      readOnly ? 'cursor-default' : 'cursor-pointer'
    } transition-transform ${!readOnly && 'hover:scale-110'}`;

    return (
      <button
        key={rating}
        type="button"
        className={`${starClass} focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1 rounded`}
        onClick={() => handleClick(rating)}
        onMouseEnter={() => !readOnly && setHoverValue(rating)}
        onMouseLeave={() => !readOnly && setHoverValue(0)}
        onKeyDown={(e) => handleKeyDown(e, rating)}
        disabled={readOnly}
        aria-label={`${rating}点`}
        aria-pressed={value === rating}
        tabIndex={readOnly ? -1 : 0}
      >
        <svg
          className={`${sizeClasses[size]} ${
            isFilled ? 'text-yellow-400' : 'text-gray-300'
          } transition-colors`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </button>
    );
  };

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="評価"
    >
      {[1, 2, 3, 4, 5].map(renderStar)}
      {value > 0 && (
        <span className="ml-2 text-sm text-gray-600" aria-live="polite">
          {value}点
        </span>
      )}
    </div>
  );
};

export default StarRating;
