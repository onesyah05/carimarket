import "server-only";

type BusinessProfileFields = {
  name: string;
  category: string;
  serviceArea: string | null;
  description: string;
};

export function hasCompleteBusinessProfile(profile: BusinessProfileFields | null): boolean {
  return Boolean(profile && [profile.name, profile.category, profile.serviceArea, profile.description]
    .every(value => Boolean(value?.trim())));
}
