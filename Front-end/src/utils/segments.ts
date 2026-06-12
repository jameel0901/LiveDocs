import { diffChars } from 'diff';
import { getUserColor } from './colors';

export interface ContentSegment {
  authorId: string;
  authorName: string;
  color: string;
  text: string;
}

export interface SegmentAuthor {
  authorId: string;
  authorName: string;
}

export const segmentsToText = (segments: ContentSegment[] = []) =>
  segments.map(segment => segment.text).join('');

export const mergeAdjacentSegments = (segments: ContentSegment[]) => {
  const merged: ContentSegment[] = [];

  segments.forEach(segment => {
    if (!segment.text) return;

    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.authorId === segment.authorId &&
      previous.color === segment.color
    ) {
      previous.text += segment.text;
      return;
    }

    merged.push({ ...segment });
  });

  return merged;
};

export const normalizeSegments = (
  segments: ContentSegment[] | undefined,
  fallbackAuthor: SegmentAuthor
): ContentSegment[] => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  return mergeAdjacentSegments(
    segments
      .filter(segment => segment && typeof segment.text === 'string')
      .map(segment => ({
        authorId: segment.authorId || fallbackAuthor.authorId,
        authorName: segment.authorName || fallbackAuthor.authorName,
        color: segment.color || getUserColor(segment.authorId || fallbackAuthor.authorId),
        text: segment.text,
      }))
  );
};

export const contentToSegments = (
  content: string,
  author: SegmentAuthor
): ContentSegment[] => {
  if (!content) return [];

  return [
    {
      authorId: author.authorId,
      authorName: author.authorName,
      color: getUserColor(author.authorId),
      text: content,
    },
  ];
};

const getAuthorAtIndex = (segments: ContentSegment[], index: number, fallback: SegmentAuthor) => {
  let position = 0;

  for (const segment of segments) {
    const end = position + segment.text.length;
    if (index < end) {
      return {
        authorId: segment.authorId,
        authorName: segment.authorName,
        color: segment.color,
      };
    }
    position = end;
  }

  return {
    authorId: fallback.authorId,
    authorName: fallback.authorName,
    color: getUserColor(fallback.authorId),
  };
};

export const applyTextEditToSegments = (
  oldSegments: ContentSegment[],
  newText: string,
  author: SegmentAuthor
): ContentSegment[] => {
  const oldText = segmentsToText(oldSegments);
  if (oldText === newText) {
    return oldSegments;
  }

  const changes = diffChars(oldText, newText);
  const result: ContentSegment[] = [];
  let oldIndex = 0;

  changes.forEach(change => {
    if (change.removed) {
      oldIndex += change.value.length;
      return;
    }

    if (change.added) {
      result.push({
        authorId: author.authorId,
        authorName: author.authorName,
        color: getUserColor(author.authorId),
        text: change.value,
      });
      return;
    }

    let buffer = '';
    let bufferAuthor:
      | { authorId: string; authorName: string; color: string }
      | null = null;

    for (let i = 0; i < change.value.length; i += 1) {
      const currentAuthor = getAuthorAtIndex(oldSegments, oldIndex + i, author);
      const authorKey = `${currentAuthor.authorId}:${currentAuthor.color}`;

      if (!bufferAuthor) {
        bufferAuthor = currentAuthor;
        buffer = change.value[i];
        continue;
      }

      const currentKey = `${bufferAuthor.authorId}:${bufferAuthor.color}`;
      if (authorKey === currentKey) {
        buffer += change.value[i];
      } else {
        result.push({
          authorId: bufferAuthor.authorId,
          authorName: bufferAuthor.authorName,
          color: bufferAuthor.color,
          text: buffer,
        });
        bufferAuthor = currentAuthor;
        buffer = change.value[i];
      }
    }

    if (bufferAuthor && buffer) {
      result.push({
        authorId: bufferAuthor.authorId,
        authorName: bufferAuthor.authorName,
        color: bufferAuthor.color,
        text: buffer,
      });
    }

    oldIndex += change.value.length;
  });

  return mergeAdjacentSegments(result);
};

export const getUniqueAuthors = (segments: ContentSegment[]) => {
  const authors = new Map<string, { authorId: string; authorName: string; color: string }>();

  segments.forEach(segment => {
    if (!authors.has(segment.authorId)) {
      authors.set(segment.authorId, {
        authorId: segment.authorId,
        authorName: segment.authorName,
        color: segment.color,
      });
    }
  });

  return Array.from(authors.values());
};
