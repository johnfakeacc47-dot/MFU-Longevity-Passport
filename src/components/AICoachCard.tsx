/**
 * AICoachCard — compact natural-language recommendation.
 * Used on Dashboard page only (Home now has its own inline AI text).
 */
import React, { useMemo } from 'react';
import { FaStar } from 'react-icons/fa';
import type { LongevityBreakdown } from '../utils/longevityScore';

interface AICoachCardProps {
  score: LongevityBreakdown;
  userName?: string;
}

function buildParagraph(score: LongevityBreakdown, name?: string): string {
  const who = name ? name : 'You';
  const { nutrition = 0, exercise = 0, sleep = 0, mental = 0, total = 0 } = score;
  const exScore = exercise || (score.activity ?? 0);

  const lines: string[] = [];

  if (total >= 80) {
    lines.push(`Outstanding day, ${who}! All four health pillars are looking great.`);
  } else if (total === 0) {
    lines.push(`Start your longevity journey, ${who}. Log one activity today and your score will update instantly.`);
    return lines[0];
  } else {
    lines.push(`Here's your health picture for today, ${who}.`);
  }

  if (nutrition >= 20)      lines.push('Nutrition is excellent — keep those food choices going.');
  else if (nutrition >= 12) lines.push('Nutrition is solid. One more balanced meal would push your score higher.');
  else if (nutrition > 0)   lines.push('Nutrition has room to grow. Try adding more whole foods or protein to your next meal.');
  else                      lines.push('No meals logged yet — snap a photo of your next meal to start your nutrition score.');

  if (exScore >= 20)        lines.push('Exercise goal crushed today — great work staying active!');
  else if (exScore >= 10)   lines.push('Good activity level. A little more movement and you\'ll hit your daily goal.');
  else if (exScore > 0)     lines.push('Movement recorded, but try to reach at least 30 minutes total today.');
  else                      lines.push('No exercise logged — even a 15-minute walk earns points toward your score.');

  if (sleep >= 20)          lines.push('Sleep quality is excellent. Consistent rest is one of the strongest longevity tools.');
  else if (sleep >= 12)     lines.push('Sleep is adequate. Trying to sleep before 23:00 would boost your score further.');
  else if (sleep > 0)       lines.push('Sleep is below target. Going to bed 30 minutes earlier tonight would make a real difference.');
  else                      lines.push('Log your sleep tonight so the app can track your rest quality.');

  if (mental >= 20)         lines.push('Mental health is in great shape — keep that positive energy going!');
  else if (mental > 0)      lines.push('A moment of mindfulness or journaling could help lift your mental score.');

  return lines.slice(0, 4).join(' ');
}

export const AICoachCard: React.FC<AICoachCardProps> = ({ score, userName }) => {
  const text = useMemo(() => buildParagraph(score, userName), [score, userName]);

  return (
    <div className="ai-coach-card">
      <div className="ai-coach-header">
        <div className="ai-coach-avatar-wrap">
          <FaStar className="ai-coach-avatar-icon" />
        </div>
        <div className="ai-coach-header-text">
          <div className="ai-coach-title">AI Health Coach</div>
          <div className="ai-coach-subtitle">
            {userName ? `Personalised for ${userName}` : 'Your daily health insight'}
          </div>
        </div>
        <div className="ai-coach-badge">AI</div>
      </div>

      <p className="ai-coach-paragraph">{text}</p>
    </div>
  );
};
