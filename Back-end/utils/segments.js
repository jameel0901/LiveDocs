const { getUserColor } = require("./userColors");

const segmentsToText = (segments = []) =>
  (segments || []).map((segment) => segment.text || "").join("");

const mergeAdjacentSegments = (segments = []) => {
  const merged = [];

  segments.forEach((segment) => {
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

const normalizeSegments = (segments, fallbackAuthor) => {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  return mergeAdjacentSegments(
    segments
      .filter((segment) => segment && typeof segment.text === "string")
      .map((segment) => ({
        authorId: segment.authorId?.toString() || fallbackAuthor?.authorId,
        authorName: segment.authorName || fallbackAuthor?.authorName || "Unknown",
        color: segment.color || getUserColor(segment.authorId),
        text: segment.text,
      }))
  );
};

const contentToSegments = (content, fallbackAuthor) => {
  if (!content) return [];

  return [
    {
      authorId: fallbackAuthor.authorId,
      authorName: fallbackAuthor.authorName,
      color: getUserColor(fallbackAuthor.authorId),
      text: content,
    },
  ];
};

const resolveDocumentSegments = (doc, fallbackAuthor) => {
  const normalized = normalizeSegments(doc.contentSegments, fallbackAuthor);

  if (normalized.length > 0) {
    return normalized;
  }

  return contentToSegments(doc.content || "", fallbackAuthor);
};

module.exports = {
  segmentsToText,
  mergeAdjacentSegments,
  normalizeSegments,
  contentToSegments,
  resolveDocumentSegments,
};
