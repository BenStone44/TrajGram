import type {
  DataType,
  NormalizationConfidence,
  NormalizationReport,
  NormalizationTrace,
  NormalizationWarning
} from './types';

const confidenceRank: Record<NormalizationConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1
};

export class NormalizationReportBuilder {
  private report: NormalizationReport;

  constructor(type: DataType, detectedShape = 'unknown') {
    this.report = {
      type,
      detectedShape,
      confidence: 'high',
      warnings: [],
      trace: []
    };
  }

  public setDetectedShape(shape: string) {
    this.report.detectedShape = shape;
  }

  public addWarning(
    code: string,
    message: string,
    path?: string,
    confidence: NormalizationConfidence = 'medium'
  ) {
    this.report.warnings.push({ code, message, path });
    this.lowerConfidence(confidence);
  }

  public addTrace(step: string, detail: string) {
    this.report.trace.push({ step, detail });
  }

  public setCounts(trajectoryCount: number, pointCount: number) {
    this.report.trajectoryCount = trajectoryCount;
    this.report.pointCount = pointCount;
  }

  public mergeTrace(traces: NormalizationTrace[]) {
    this.report.trace.push(...traces);
  }

  public mergeWarnings(warnings: NormalizationWarning[]) {
    this.report.warnings.push(...warnings);
  }

  public lowerConfidence(next: NormalizationConfidence) {
    if (confidenceRank[next] < confidenceRank[this.report.confidence]) {
      this.report.confidence = next;
    }
  }

  public build(): NormalizationReport {
    return {
      ...this.report,
      warnings: [...this.report.warnings],
      trace: [...this.report.trace]
    };
  }
}
