import React from 'react';
import { useCountUp } from '../hooks/useCountUp';
import StatCard from './StatCard';
import MetricInfo from './MetricInfo';

export interface DashboardAnalyticsData {
  ownedDocuments: number;
  sharedWithYou: number;
  incomingRequests: number;
  outgoingRequests: number;
  collaborators: number;
  networksJoined?: number;
  discoverableDocuments: number;
  totalWords: number;
  totalCharacters: number;
  editAccessCount: number;
  viewAccessCount: number;
  collaborationScore: number;
  weeklyActivity: { label: string; count: number }[];
  recentActivity: {
    type: 'created' | 'shared';
    title: string;
    subtitle: string;
    date: string;
  }[];
}

interface DashboardAnalyticsProps {
  analytics: DashboardAnalyticsData;
}

const METRIC_DEFINITIONS = {
  collabScore:
    'A collaboration activity score from 0–100 based on documents you own, documents shared with you, pending requests, and members in your networks.',
  ownedDocuments: 'Documents you created and own. You have full read and write access to these.',
  sharedWithYou:
    'Documents other users have shared with you. Your access level may be read-only or write depending on the permission granted.',
  totalWords:
    'Total words written across all documents you own or have been granted access to.',
  pendingRequests:
    'Combined count of incoming access requests waiting for your approval and outgoing requests you have sent to others.',
};

const DonutChart: React.FC<{
  editCount: number;
  viewCount: number;
  ownedCount: number;
}> = ({ editCount, viewCount, ownedCount }) => {
  const total = Math.max(editCount + viewCount + ownedCount, 1);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { value: ownedCount, color: '#818cf8', label: 'Owned' },
    { value: editCount, color: '#34d399', label: 'Edit access' },
    { value: viewCount, color: '#22d3ee', label: 'View access' },
  ];

  let offset = 0;

  return (
    <div className="donut-chart">
      <div className="donut-chart__visual">
        <svg viewBox="0 0 140 140" className="donut-chart__svg" aria-hidden="true">
          <circle cx="70" cy="70" r={radius} className="donut-chart__track" />
          {segments.map(segment => {
            const length = (segment.value / total) * circumference;
            const circle = (
              <circle
                key={segment.label}
                cx="70"
                cy="70"
                r={radius}
                className="donut-chart__segment"
                stroke={segment.color}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="donut-chart__center">
          <strong>{total}</strong>
          <span>docs</span>
        </div>
      </div>
      <ul className="donut-chart__legend">
        {segments.map(segment => (
          <li key={segment.label}>
            <span style={{ background: segment.color }} />
            {segment.label} ({segment.value})
          </li>
        ))}
      </ul>
    </div>
  );
};

const ActivityBars: React.FC<{
  data: { label: string; count: number }[];
}> = ({ data }) => {
  const max = Math.max(...data.map(item => item.count), 1);

  return (
    <div className="activity-bars">
      {data.map((item, index) => (
        <div
          key={item.label}
          className="activity-bars__item animate-in"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="activity-bars__bar-wrap">
            <div
              className="activity-bars__bar"
              style={{ height: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="activity-bars__count">{item.count}</span>
          <span className="activity-bars__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({ analytics }) => {
  const score = useCountUp(analytics.collaborationScore, 1200);

  return (
    <section className="analytics-section">
      <div className="analytics-header animate-in">
        <div>
          <h2>Workspace Analytics</h2>
          <p>Live insights into your documents, collaboration, and writing activity.</p>
        </div>
        <div className="score-ring-wrap">
          <div className="score-ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="48" className="score-ring__track" />
              <circle
                cx="60"
                cy="60"
                r="48"
                className="score-ring__progress"
                style={{
                  strokeDasharray: `${(score / 100) * 301.59} 301.59`,
                }}
              />
            </svg>
            <div className="score-ring__value">
              <strong>{score}</strong>
            </div>
          </div>
          <div className="score-ring__caption">
            <span>Collab Score</span>
            <MetricInfo label="Collab Score" definition={METRIC_DEFINITIONS.collabScore} />
          </div>
        </div>
      </div>

      <div className="analytics-stats">
        <StatCard
          label="Your Documents"
          value={analytics.ownedDocuments}
          icon="📄"
          tone="primary"
          delay={0}
          definition={METRIC_DEFINITIONS.ownedDocuments}
        />
        <StatCard
          label="Shared With You"
          value={analytics.sharedWithYou}
          icon="🤝"
          tone="accent"
          delay={80}
          definition={METRIC_DEFINITIONS.sharedWithYou}
        />
        <StatCard
          label="Total Words"
          value={analytics.totalWords}
          icon="✍️"
          tone="success"
          delay={160}
          definition={METRIC_DEFINITIONS.totalWords}
        />
        <StatCard
          label="Pending Requests"
          value={analytics.incomingRequests + analytics.outgoingRequests}
          icon="📬"
          tone="warning"
          delay={240}
          definition={METRIC_DEFINITIONS.pendingRequests}
        />
      </div>

      <div className="analytics-grid">
        <article className="analytics-panel glass-card animate-in" style={{ animationDelay: '120ms' }}>
          <div className="panel-header">
            <h3>7-Day Activity</h3>
            <span>Documents & shares</span>
          </div>
          <ActivityBars data={analytics.weeklyActivity} />
        </article>

        <article className="analytics-panel glass-card animate-in" style={{ animationDelay: '200ms' }}>
          <div className="panel-header">
            <h3>Access Breakdown</h3>
            <span>Ownership & permissions</span>
          </div>
          <DonutChart
            ownedCount={analytics.ownedDocuments}
            editCount={analytics.editAccessCount}
            viewCount={analytics.viewAccessCount}
          />
        </article>

        <article className="analytics-panel glass-card animate-in" style={{ animationDelay: '280ms' }}>
          <div className="panel-header">
            <h3>Recent Activity</h3>
            <span>Latest workspace events</span>
          </div>
          <ul className="activity-feed">
            {analytics.recentActivity.length === 0 ? (
              <li className="empty-state">No recent activity yet. Create or share a document.</li>
            ) : (
              analytics.recentActivity.map((item, index) => (
                <li
                  key={`${item.type}-${item.title}-${item.date}`}
                  className="activity-feed__item animate-in"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className={`activity-feed__dot activity-feed__dot--${item.type}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.subtitle}</p>
                    <small>{new Date(item.date).toLocaleString()}</small>
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="analytics-panel glass-card animate-in" style={{ animationDelay: '360ms' }}>
          <div className="panel-header">
            <h3>Network Pulse</h3>
            <span>Collaboration reach</span>
          </div>
          <div className="pulse-metrics">
            <div className="pulse-metric">
              <span className="pulse-metric__value">{analytics.networksJoined ?? 0}</span>
              <span className="pulse-metric__label">Networks</span>
            </div>
            <div className="pulse-metric">
              <span className="pulse-metric__value">{analytics.collaborators}</span>
              <span className="pulse-metric__label">Network Members</span>
            </div>
            <div className="pulse-metric">
              <span className="pulse-metric__value">{analytics.discoverableDocuments}</span>
              <span className="pulse-metric__label">Shared in Network</span>
            </div>
            <div className="pulse-metric">
              <span className="pulse-metric__value">
                {analytics.totalCharacters.toLocaleString()}
              </span>
              <span className="pulse-metric__label">Characters Written</span>
            </div>
          </div>
          <div className="pulse-wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </article>
      </div>
    </section>
  );
};

export default DashboardAnalytics;
