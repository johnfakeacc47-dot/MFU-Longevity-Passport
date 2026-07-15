import React from 'react';
import { LuClock3, LuActivity, LuInfo, LuCircleCheck, LuCircleAlert } from 'react-icons/lu';

export interface QualityResult {
  score: number;       // 1 - 10
  labelEn: string;     // Very Poor, Poor, Fair, Good, Excessive
  labelTh: string;     // แย่มาก, แย่, พอใช้, ดี, มากเกินไป
  color: string;       // Hex color for badge / indicator
  bgLight: string;     // Soft background color
  insight: string;     // Smart health insight
  levelIndex: number;  // 0: Very Poor, 1: Poor, 2: Fair, 3: Good, 4: Excessive
}

export function calculateSleepQuality(duration: number, bedtime: string): QualityResult {
  const [bH] = bedtime.split(':').map(Number);
  // Check if bedtime is late (between 01:00 and 04:59 AM)
  const isLateBedtime = bH >= 1 && bH < 5;

  if (duration < 5) {
    return {
      score: 2,
      labelEn: 'Very Poor',
      labelTh: 'แย่มาก',
      color: '#ef4444', // red-500
      bgLight: '#fef2f2',
      insight: 'พักผ่อนน้อยเกินไป ส่งผลกระทบโดยตรงต่อระบบภูมิคุ้มกันและการฟื้นฟูเซลล์',
      levelIndex: 0,
    };
  } else if (duration < 6) {
    return {
      score: 4,
      labelEn: 'Poor',
      labelTh: 'แย่',
      color: '#f97316', // orange-500
      bgLight: '#fff7ed',
      insight: isLateBedtime
        ? 'นอนดึกและเวลานอนน้อย ควรเข้านอนก่อน 23:00 เพื่อ Growth Hormone ที่ดี'
        : 'ชั่วโมงการนอนยังต่ำกว่าเกณฑ์เป้าหมาย ควรเพิ่มเวลาพักผ่อนอีก 1-2 ชั่วโมง',
      levelIndex: 1,
    };
  } else if (duration < 7) {
    return {
      score: 6,
      labelEn: 'Fair',
      labelTh: 'พอใช้',
      color: '#eab308', // yellow-500
      bgLight: '#fefce8',
      insight: isLateBedtime
        ? 'ระยะเวลาพอใช้ แต่เข้านอนดึกเกินไป อาจรบกวนวงจรนาฬิกาชีวภาพ (Circadian Rhythm)'
        : 'ระดับการฟื้นฟูร่างกายปานกลาง สามารถพัฒนาให้ดีขึ้นโดยเข้านอนเร็วขึ้นเล็กน้อย',
      levelIndex: 2,
    };
  } else if (duration <= 9) {
    // 7 to 9 hours is optimal!
    const isOptimalRange = duration >= 7.5 && duration <= 8.5 && !isLateBedtime;
    return {
      score: isOptimalRange ? 10 : 9,
      labelEn: 'Good',
      labelTh: 'ดี',
      color: '#10b981', // emerald-500
      bgLight: '#ecfdf5',
      insight: isLateBedtime
        ? 'ชั่วโมงการนอนเพียงพอ แนะนำปรับเวลาเข้านอนให้เร็วขึ้นเพื่อคุณภาพการหลับลึก'
        : 'ช่วงเวลานอนและระยะเวลาเหมาะสมที่สุด ดีมากสำหรับการฟื้นฟูระบบประสาทและกล้ามเนื้อ',
      levelIndex: 3,
    };
  } else {
    // > 9 hours
    return {
      score: 7,
      labelEn: 'Excessive',
      labelTh: 'มากเกินไป',
      color: '#06b6d4', // cyan-500
      bgLight: '#ecfeff',
      insight: 'นอนมากกว่า 9 ชั่วโมง อาจทำให้รู้สึกอ่อนเพลียหรือเซื่องซึมระหว่างวัน',
      levelIndex: 4,
    };
  }
}

interface SleepQualityIndicatorProps {
  duration: number;
  bedtime: string;
}

const SEGMENTS = [
  { label: 'Very Poor', th: 'แย่มาก' },
  { label: 'Poor',      th: 'แย่' },
  { label: 'Fair',      th: 'พอใช้' },
  { label: 'Good',      th: 'ดี' },
  { label: 'Excessive', th: 'มากไป' },
];

export const SleepQualityIndicator: React.FC<SleepQualityIndicatorProps> = ({ duration, bedtime }) => {
  const quality = calculateSleepQuality(duration, bedtime);

  return (
    <div className="sleep-quality-card">
      {/* Header Info */}
      <div className="sq-info-grid">
        <div className="sq-info-item">
          <div className="sq-label">
            <LuClock3 className="sq-icon" />
            <span>Sleep Duration</span>
          </div>
          <div className="sq-value">
            <strong>{duration}</strong> <span className="sq-unit">hours</span>
          </div>
        </div>

        <div className="sq-info-item">
          <div className="sq-label">
            <LuActivity className="sq-icon" style={{ color: quality.color }} />
            <span>Auto Quality</span>
          </div>
          <div className="sq-value-badge-wrap">
            <span
              className="sq-badge"
              style={{
                backgroundColor: quality.bgLight,
                color: quality.color,
                borderColor: `${quality.color}40`,
              }}
            >
              ★ {quality.labelEn.toUpperCase()} ({quality.score}/10)
            </span>
          </div>
        </div>
      </div>

      {/* Readonly Segmented Progress / Indicator */}
      <div className="sq-segmented-wrap">
        <div className="sq-bars">
          {SEGMENTS.map((seg, idx) => {
            const isActive = idx === quality.levelIndex;
            return (
              <div
                key={seg.label}
                className={`sq-bar-segment ${isActive ? 'sq-bar--active' : ''}`}
                style={{
                  backgroundColor: isActive ? quality.color : '#e2e8f0',
                  boxShadow: isActive ? `0 0 10px ${quality.color}60` : 'none',
                }}
              />
            );
          })}
        </div>

        <div className="sq-labels">
          {SEGMENTS.map((seg, idx) => {
            const isActive = idx === quality.levelIndex;
            return (
              <span
                key={seg.label}
                className={`sq-label-item ${isActive ? 'sq-label--active' : ''}`}
                style={{ color: isActive ? quality.color : '#94a3b8' }}
              >
                {seg.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Smart Health Insight */}
      <div className="sq-insight-box" style={{ backgroundColor: quality.bgLight, borderColor: `${quality.color}30` }}>
        <div className="sq-insight-icon" style={{ color: quality.color }}>
          {quality.levelIndex === 3 ? <LuCircleCheck /> : quality.levelIndex <= 1 ? <LuCircleAlert /> : <LuInfo />}
        </div>
        <div className="sq-insight-text">
          <span className="sq-insight-title" style={{ color: quality.color }}>
            ● Quality Indicator
          </span>
          <p className="sq-insight-desc">{quality.insight}</p>
        </div>
      </div>
    </div>
  );
};
