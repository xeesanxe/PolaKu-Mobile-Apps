import React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/Themed';
import { AuthDesign } from '@/constants/AuthDesign';

interface TrendChartProps {
  data: Array<{
    date: string;
    value: number;
  }>;
  metric: 'sleep' | 'stress';
  labels: string[];
}

/**
 * Custom SVG-based Trend Chart Component
 * Menggantikan react-native-chart-kit untuk menghindari dependency issues
 * 
 * Usage:
 * <TrendChart 
 *   data={trendLogs.map(l => ({ date: l.date, value: trendMetric === 'sleep' ? l.sleepHours : l.stressLevel }))} 
 *   metric={trendMetric} 
 *   labels={trendLogs.map(l => dayLabel(l.date))}
 * />
 */

export const TrendChart: React.FC<TrendChartProps> = ({ data, metric, labels }) => {
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const chartWidth = SCREEN_WIDTH - 64;
  const chartHeight = 180;
  const padding = 30;
  
  // Determine max value based on metric
  const maxValue = metric === 'sleep' ? 12 : 10;
  const minValue = 0;

  // Calculate SVG dimensions
  const svgWidth = chartWidth;
  const svgHeight = chartHeight;
  const plotWidth = svgWidth - padding * 2;
  const plotHeight = svgHeight - padding * 2;

  // Scale functions
  const scaleX = (index: number) => padding + (index / (data.length - 1)) * plotWidth;
  const scaleY = (value: number) => padding + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight;

  // Create polyline points
  const points = data.map((d, i) => `${scaleX(i)},${scaleY(d.value)}`).join(' ');

  // Create axis labels (Y-axis)
  const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
    const value = (maxValue / 4) * i;
    return {
      value,
      y: padding + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight,
    };
  });

  const getMetricLabel = () => {
    if (metric === 'sleep') return 'Jam';
    return 'Skala (1-10)';
  };

  const getChartColor = () => {
    return metric === 'sleep' ? '#2563EB' : '#DC2626';
  };

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <View style={{ width: chartWidth, height: chartHeight, backgroundColor: '#FAF5FF', borderRadius: 8 }}>
        <Svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%">
          {/* Grid Lines */}
          {yAxisLabels.map((label, i) => (
            <G key={`grid-${i}`}>
              <Line
                x1={padding}
                y1={label.y}
                x2={svgWidth - padding}
                y2={label.y}
                stroke="#E5E7EB"
                strokeWidth="1"
                strokeDasharray={i === 2 ? '0' : '4'}
              />
              <SvgText
                x={padding - 5}
                y={label.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6B7280"
              >
                {label.value.toFixed(0)}
              </SvgText>
            </G>
          ))}

          {/* X-Axis */}
          <Line x1={padding} y1={scaleY(0)} x2={svgWidth - padding} y2={scaleY(0)} stroke="#D1D5DB" strokeWidth="2" />

          {/* X-Axis Labels */}
          {labels.map((label, i) => (
            <SvgText
              key={`label-${i}`}
              x={scaleX(i)}
              y={scaleY(0) + 18}
              textAnchor="middle"
              fontSize="11"
              fill="#6B7280"
            >
              {label}
            </SvgText>
          ))}

          {/* Main Polyline Chart */}
          <Polyline fill="none" stroke={getChartColor()} strokeWidth="3" points={points} />

          {/* Data Points */}
          {data.map((d, i) => (
            <Circle
              key={`point-${i}`}
              cx={scaleX(i)}
              cy={scaleY(d.value)}
              r="4"
              fill={getChartColor()}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          ))}
        </Svg>
      </View>

      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
        {metric === 'sleep' ? '⏱️ Durasi Tidur' : '⚡ Tingkat Stres'} ({getMetricLabel()})
      </Text>
    </View>
  );
};

export default TrendChart;
