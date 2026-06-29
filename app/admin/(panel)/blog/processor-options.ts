import { connectToDatabase } from "@/lib/db";
import { Processor } from "@/models";

/** {id, name} of every processor, for the BlogForm "related processors" picker. */
export async function getProcessorOptions(): Promise<{ id: string; name: string }[]> {
  await connectToDatabase();
  const docs = await Processor.find().select("name").sort({ name: 1 }).lean();
  return docs.map((d) => ({ id: String(d._id), name: d.name }));
}
