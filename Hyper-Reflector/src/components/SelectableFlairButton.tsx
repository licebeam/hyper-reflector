import { Button, Flex, Text } from "@chakra-ui/react";
import TitleBadge from "./TitleBadge";
import { Check } from "lucide-react";
import type { TUserTitle } from "../types/user";

type SelectableFlairButtonProps = {
  flair: TUserTitle;
  label?: string;
  isActive?: boolean;
  onClick?: () => void;
};

export default function SelectableFlairButton({
  flair,
  label,
  isActive,
  onClick,
}: SelectableFlairButtonProps) {
  return (
    <Button
      variant={isActive ? "solid" : "outline"}
      colorPalette={isActive ? "orange" : undefined}
      justifyContent="space-between"
      size="sm"
      onClick={onClick}
      width="100%"
    >
      <Flex align="center" gap="3">
        <TitleBadge title={flair} />
        <Text fontSize="sm" color="gray.300">
          {label ?? flair.title}
        </Text>
      </Flex>
      {isActive ? <Check size={16} /> : null}
    </Button>
  );
}
