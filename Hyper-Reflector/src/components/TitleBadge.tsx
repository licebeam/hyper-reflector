import { Badge, Box } from "@chakra-ui/react";

function TitleBadge(titleObj: any) {
  // if (!titleObj.title) return null
  // TODO: Something odd is going on with title objects.
  const { title, bgColor, border, color } = titleObj?.title || {};

  return (
    <Box width={20} height={"24px"}>
      <Badge
        size="xs"
        bg={bgColor || "none"}
        color={color || ""}
        border={`1px solid ${border}`}
      >
        {title ? title : ""}
      </Badge>
    </Box>
  );
}

export default TitleBadge;
