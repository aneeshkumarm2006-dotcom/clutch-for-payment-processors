/**
 * Model barrel. Importing from "@/models" pulls every model so each schema is
 * registered with Mongoose before any populate() / ref lookup runs — avoids
 * "MissingSchemaError" when a route only imports one model but populates another.
 */
export { Processor, type IProcessor, type IProcessorFees } from "./Processor";
export { Category, type ICategory } from "./Category";
export { Review, type IReview } from "./Review";
export { Lead, type ILead } from "./Lead";
export { Submission, type ISubmission } from "./Submission";
export { BlogPost, type IBlogPost } from "./BlogPost";
export {
  Media,
  type IMedia,
  type MediaProvider,
  type MediaSource,
} from "./Media";
export { User, type IUser } from "./User";
export { SiteSettings, type ISiteSettings } from "./SiteSettings";
export {
  AuditLog,
  type IAuditLog,
  type AuditAction,
  type AuditEntity,
} from "./AuditLog";
export { AnalyticsHubConfig, type IAnalyticsHubConfig } from "./AnalyticsHubConfig";
export { type ISeo } from "./shared";
