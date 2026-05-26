"use client";

import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";

type SignOutButtonProps = {
  className?: string;
  label?: string;
};

export default function SignOutButton({
  className = "btn small",
  label = "Log out",
}: SignOutButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button className={className} type="button" onClick={handleSignOut}>
      {label}
    </button>
  );
}
