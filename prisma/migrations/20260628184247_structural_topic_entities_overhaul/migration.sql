-- AlterTable
ALTER TABLE "geopolitics_articles" ADD COLUMN     "topic_id" TEXT;

-- AlterTable
ALTER TABLE "markets_articles" ADD COLUMN     "topic_id" TEXT;

-- AlterTable
ALTER TABLE "tech_articles" ADD COLUMN     "topic_id" TEXT;

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_vertical" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- AddForeignKey
ALTER TABLE "geopolitics_articles" ADD CONSTRAINT "geopolitics_articles_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets_articles" ADD CONSTRAINT "markets_articles_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_articles" ADD CONSTRAINT "tech_articles_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
