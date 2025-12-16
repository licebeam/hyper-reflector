import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Flex, Heading, Input, Spinner, Stack, Text } from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { auth } from "../utils/firebase";
import api from "../external-api/requests";
import { toaster } from "../components/chakra/ui/toaster";
import { useUserStore, useSettingsStore } from "../state/store";
import type { TUser, TUserTitle } from "../types/user";
import { FlairToolsPanel } from "../components/admin/FlairToolsPanel";
import { ThemeWorkshopPanel } from "../components/admin/ThemeWorkshopPanel";

const DEFAULT_BG = "#1f1f24";
const DEFAULT_BORDER = "#37373f";
const DEFAULT_TEXT = "#f2f2f7";

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const globalUser = useUserStore((s) => s.globalUser);
  const globalLoggedIn = useUserStore((s) => s.globalLoggedIn);
  const accentColor = useSettingsStore((s) => s.theme.colorPalette);
  const [titleDraft, setTitleDraft] = useState("");
  const [bgColor, setBgColor] = useState(DEFAULT_BG);
  const [borderColor, setBorderColor] = useState(DEFAULT_BORDER);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT);
  const [conditionalFlairs, setConditionalFlairs] = useState<TUserTitle[]>([]);
  const [, setGlobalFlairs] = useState<TUserTitle[]>([]);
  const [flairsLoading, setFlairsLoading] = useState(true);
  const [flairRefresh, setFlairRefresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Partial<TUser>[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<Partial<TUser> | null>(null);
  const [poolType, setPoolType] = useState<"global" | "conditional">(
    "conditional"
  );
  const [assigning, setAssigning] = useState(false);
  const [selectedConditionalFlair, setSelectedConditionalFlair] =
    useState<TUserTitle | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const isAdmin = globalUser?.role === "admin";
  const previewTitle = useMemo<TUserTitle>(
    () => ({
      title: titleDraft.trim() || "Sample Flair",
      bgColor,
      border: borderColor,
      color: textColor,
    }),
    [titleDraft, bgColor, borderColor, textColor]
  );

  useEffect(() => {
    if (!auth.currentUser || !globalUser) {
      setConditionalFlairs([]);
      setGlobalFlairs([]);
      setFlairsLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setFlairsLoading(true);
      try {
        const [globalData, conditionalData] = await Promise.all([
          api.getAllTitles(auth, globalUser.uid),
          api.getConditionalFlairs(auth),
        ]);
        if (cancelled) return;
        const globalList =
          globalData &&
          typeof globalData === "object" &&
          Array.isArray((globalData as any).titleData?.titles)
            ? ((globalData as any).titleData.titles as TUserTitle[])
            : [];
        const conditionalList =
          conditionalData &&
          typeof conditionalData === "object" &&
          Array.isArray((conditionalData as any).flairs)
            ? ((conditionalData as any).flairs as TUserTitle[])
            : [];
        setGlobalFlairs(globalList);
        setConditionalFlairs(conditionalList);
        if (!selectedConditionalFlair && conditionalList.length) {
          setSelectedConditionalFlair(conditionalList[0]);
        }
      } catch (error) {
        console.error("Failed to load flairs", error);
        if (!cancelled) {
          setConditionalFlairs([]);
          setGlobalFlairs([]);
        }
      } finally {
        if (!cancelled) {
          setFlairsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [globalUser?.uid, flairRefresh]);

  const handleSearch = useCallback(async () => {
    if (!auth.currentUser) {
      return;
    }
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSearchError("Enter a name or UID to begin searching.");
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const response = await api.searchUsers(auth, trimmed, null, 25);
      const users = response?.users ?? [];
      setSearchResults(users);
      if (!users.length) {
        setSearchError("No users found that match that query.");
      }
    } catch (error) {
      console.error("Admin search failed", error);
      setSearchError("Unable to search right now.");
    } finally {
      setSearchLoading(false);
    }
  }, [searchTerm]);

  const handleCreateFlair = useCallback(async () => {
    if (!auth.currentUser) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      toaster.create({
        title: "Title required",
        description: "Give the new flair a name before saving.",
      });
      return;
    }
    setCreating(true);
    const payload: TUserTitle = {
      title: trimmed,
      bgColor,
      border: borderColor,
      color: textColor,
    };
    try {
      const response =
        poolType === "conditional"
          ? await api.createConditionalFlair(auth, payload)
          : await api.createTitleFlair(auth, payload);
      const createdFlair =
        response &&
        typeof response === "object" &&
        response.flair &&
        typeof response.flair === "object"
          ? (response.flair as TUserTitle)
          : payload;
      if (poolType === "conditional") {
        setConditionalFlairs((prev) => [createdFlair, ...prev]);
        setSelectedConditionalFlair(createdFlair);
      } else {
        setGlobalFlairs((prev) => [createdFlair, ...prev]);
      }
      setSelectedConditionalFlair(createdFlair);
      setFlairRefresh((prev) => prev + 1);
      toaster.create({
        title: "Flair created",
        description: `${createdFlair.title} is available for assignment.`,
      });
      setTitleDraft("");
    } catch (error) {
      console.error("Failed to create flair", error);
      toaster.create({
        title: "Creation failed",
        description: "Please try again shortly.",
      });
    } finally {
      setCreating(false);
    }
  }, [titleDraft, bgColor, borderColor, textColor]);

  const handleAssignFlair = useCallback(async () => {
    if (!auth.currentUser || !selectedUser?.uid) return;
    const flairToGrant = selectedConditionalFlair;
    if (!flairToGrant) return;
    setAssigning(true);
    try {
      const response = await api.grantConditionalFlair(
        auth,
        selectedUser.uid,
        flairToGrant
      );
      if (response) {
        toaster.create({
          title: "Flair assigned",
          description: `${flairToGrant.title} is now tied to ${
            selectedUser.userName ?? selectedUser.uid
          }.`,
        });
      } else {
        throw new Error("Server rejected assignment");
      }
    } catch (error) {
      console.error("Failed to assign flair", error);
      toaster.create({
        title: "Assignment failed",
        description: "Please try again soon.",
      });
    } finally {
      setAssigning(false);
    }
  }, [selectedUser, selectedConditionalFlair]);

  if (!globalLoggedIn || !auth.currentUser) {
    return (
      <Stack gap={4}>
        <Heading size="lg">Admin tools</Heading>
        <Text color="gray.400">
          Sign in as an admin to manage title flairs and experiments.
        </Text>
        <Button onClick={() => navigate({ to: "/" })}>Sign in</Button>
      </Stack>
    );
  }

  if (globalLoggedIn && !globalUser) {
    return (
      <Stack gap={4}>
        <Heading size="lg">Admin tools</Heading>
        <Spinner />
        <Text color="gray.400">Loading your account details.</Text>
      </Stack>
    );
  }

  if (!isAdmin) {
    return (
      <Stack gap={4}>
        <Heading size="lg">Admin tools</Heading>
        <Text color="gray.400">
          You need admin privileges to view this page.
        </Text>
        <Button onClick={() => navigate({ to: "/lobby" })}>
          Back to dashboard
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading size="lg">Admin Panel</Heading>
        <Text color="gray.400" maxW="2xl">
          Create new title flairs, assign them to players, or experiment with
          JSON themes for the Chakra system.
        </Text>
      </Stack>

      <Stack>
        <Flex
          gap={3}
          borderBottomWidth="1px"
          borderColor="gray.800"
          pt={2}
          pb={1}
        >
          <Button
            variant={tabIndex === 0 ? "solid" : "ghost"}
            onClick={() => setTabIndex(0)}
          >
            Flair tools
          </Button>
          <Button
            variant={tabIndex === 1 ? "solid" : "ghost"}
            onClick={() => setTabIndex(1)}
          >
            Theme workshop
          </Button>
        </Flex>
        {tabIndex === 0 ? (
          <FlairToolsPanel
            accentColor={accentColor}
            previewTitle={previewTitle}
            titleDraft={titleDraft}
            onTitleDraftChange={setTitleDraft}
            bgColor={bgColor}
            onBgColorChange={setBgColor}
            textColor={textColor}
            onTextColorChange={setTextColor}
            borderColor={borderColor}
            onBorderColorChange={setBorderColor}
            poolType={poolType}
            onPoolTypeChange={setPoolType}
            creating={creating}
            onCreateFlair={handleCreateFlair}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchResults={searchResults}
            searchLoading={searchLoading}
            searchError={searchError}
            onSearch={handleSearch}
            selectedUser={selectedUser}
            onSelectUser={(user) => setSelectedUser(user)}
            flairsLoading={flairsLoading}
            conditionalFlairs={conditionalFlairs}
            selectedConditionalFlair={selectedConditionalFlair}
            onSelectConditionalFlair={setSelectedConditionalFlair}
            onAssignFlair={handleAssignFlair}
            assigning={assigning}
          />
        ) : (
          <ThemeWorkshopPanel />
        )}
      </Stack>
    </Stack>
  );
}
