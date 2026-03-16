type StructuredDataScriptProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function StructuredDataScript({ data }: StructuredDataScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

