import mongoose, { Document, Schema } from 'mongoose';

export interface IEndpointCheck extends Document {
  endpointId: mongoose.Types.ObjectId;
  checkedAt: Date;
  status: 'up' | 'down' | 'degraded';
  httpStatus: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

const endpointCheckSchema = new Schema<IEndpointCheck>({
  endpointId: {
    type: Schema.Types.ObjectId,
    ref: 'Endpoint',
    required: true
  },
  checkedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['up', 'down', 'degraded'], required: true },
  httpStatus: { type: Number, default: null },
  responseTimeMs: { type: Number, default: null },
  error: { type: String, default: null }
});

endpointCheckSchema.index({ endpointId: 1, checkedAt: -1 });
// TTL: drop raw checks older than 35 days
endpointCheckSchema.index({ checkedAt: 1 }, { expireAfterSeconds: 35 * 24 * 60 * 60 });

export default mongoose.model<IEndpointCheck>('EndpointCheck', endpointCheckSchema);
