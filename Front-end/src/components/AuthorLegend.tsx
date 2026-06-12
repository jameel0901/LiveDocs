import React from 'react';
import { ContentSegment, getUniqueAuthors } from '../utils/segments';

interface AuthorLegendProps {
  segments: ContentSegment[];
  currentUserId?: string;
}

const AuthorLegend: React.FC<AuthorLegendProps> = ({ segments, currentUserId }) => {
  const authors = getUniqueAuthors(segments);

  if (authors.length === 0) {
    return null;
  }

  return (
    <div className="author-legend">
      <span className="author-legend__title">Authors</span>
      <ul className="author-legend__list">
        {authors.map(author => (
          <li key={author.authorId} className="author-legend__item">
            <span
              className="author-legend__swatch"
              style={{ backgroundColor: author.color }}
              aria-hidden="true"
            />
            <span className="author-legend__name">
              {author.authorName}
              {author.authorId === currentUserId ? ' (you)' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AuthorLegend;
