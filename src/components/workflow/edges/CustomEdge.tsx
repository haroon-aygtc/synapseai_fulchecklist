import React from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  MarkerType,
} from 'reactflow';
import { Badge } from '@/components/ui/badge';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const getEdgeColor = () => {
    if (data?.type === 'success') return '#10b981';
    if (data?.type === 'error') return '#ef4444';
    if (data?.type === 'condition_true') return '#10b981';
    if (data?.type === 'condition_false') return '#ef4444';
    return '#6b7280';
  };

  const getEdgeStyle = () => ({
    ...style,
    stroke: getEdgeColor(),
    strokeWidth: data?.priority === 'high' ? 3 : 2,
    strokeDasharray: data?.conditional ? '5,5' : undefined,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={getEdgeStyle()}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <Badge 
              variant="secondary" 
              className="bg-white border shadow-sm text-xs"
            >
              {data.label}
            </Badge>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}