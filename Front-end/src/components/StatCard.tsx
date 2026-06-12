import React from 'react';
import { useCountUp } from '../hooks/useCountUp';
import MetricInfo from './MetricInfo';

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  tone?: 'primary' | 'accent' | 'success' | 'warning';
  delay?: number;
  active?: boolean;
  definition?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  suffix = '',
  icon,
  tone = 'primary',
  delay = 0,
  active = true,
  definition,
}) => {
  const animatedValue = useCountUp(value, 900, active);

  return (
    <article
      className={`stat-card stat-card--${tone} animate-in`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="stat-card__glow" aria-hidden="true" />
      {definition && (
        <div className="stat-card__info">
          <MetricInfo label={label} definition={definition} />
        </div>
      )}
      <div className="stat-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="stat-card__content">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">
          {animatedValue.toLocaleString()}
          {suffix}
        </p>
      </div>
    </article>
  );
};

export default StatCard;
