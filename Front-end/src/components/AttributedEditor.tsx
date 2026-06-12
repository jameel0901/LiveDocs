import React, { useEffect, useRef } from 'react';
import {
  ContentSegment,
  SegmentAuthor,
  applyTextEditToSegments,
  segmentsToText,
} from '../utils/segments';

interface AttributedEditorProps {
  segments: ContentSegment[];
  currentAuthor: SegmentAuthor;
  onChange: (segments: ContentSegment[]) => void;
  onTyping?: () => void;
  readOnly?: boolean;
  placeholder?: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

const AttributedEditor: React.FC<AttributedEditorProps> = ({
  segments,
  currentAuthor,
  onChange,
  onTyping,
  readOnly = false,
  placeholder = 'Start writing...',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isLocalUpdate = useRef(false);
  const segmentsRef = useRef(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || readOnly || isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }

    editor.innerHTML = segments
      .map(
        (segment, index) =>
          `<span data-segment="${index}" style="color:${segment.color}">${escapeHtml(
            segment.text
          )}</span>`
      )
      .join('');
  }, [segments, readOnly]);

  const handleInput = () => {
    if (readOnly) return;

    const editor = editorRef.current;
    if (!editor) return;

    const newText = editor.innerText;
    isLocalUpdate.current = true;
    onChange(
      applyTextEditToSegments(segmentsRef.current, newText, {
        ...currentAuthor,
      })
    );
    onTyping?.();
  };

  const isEmpty = segmentsToText(segments).length === 0;

  if (readOnly) {
    return (
      <div className="attributed-editor attributed-editor--readonly" role="textbox" aria-readonly>
        {isEmpty ? (
          <span className="attributed-editor__placeholder">{placeholder}</span>
        ) : (
          segments.map((segment, index) => (
            <span key={`${segment.authorId}-${index}`} style={{ color: segment.color }}>
              {segment.text}
            </span>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="attributed-editor-wrap">
      {isEmpty && <div className="attributed-editor__placeholder">{placeholder}</div>}
      <div
        ref={editorRef}
        className="attributed-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={onTyping}
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
};

export default AttributedEditor;
