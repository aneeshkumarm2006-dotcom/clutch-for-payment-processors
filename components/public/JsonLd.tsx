/**
 * Renders one or more JSON-LD nodes into a <script> tag (PRD §13). Pass objects
 * built by `lib/seo.ts`. Safe because the data is our own structured content.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const nodes = Array.isArray(data) ? data : [data];
  return (
    <>
      {nodes.map((node, i) => (
        <script
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
    </>
  );
}

export default JsonLd;
