import { redirect } from "next/navigation";

interface WorkRootPageProps {
  params: {
    slug: string;
  };
}

export default function WorkRootPage({ params }: WorkRootPageProps) {
  const slug = decodeURIComponent(params.slug);
  redirect(`/works/${encodeURIComponent(slug)}/overview`);
}
